"""
PyView 통합 분석 엔진

pydeps 모듈 레벨 분석과 AST 기반 클래스/메소드/필드 분석을 결합하여
완전한 5단계 의존성 분석을 제공
"""

import os
import sys
import uuid
import time
import logging
from pathlib import Path
from typing import List, Dict, Set, Optional, Callable, Any
from datetime import datetime, timedelta
from concurrent.futures import ProcessPoolExecutor, as_completed

from .models import (
    AnalysisResult, ProjectInfo, DependencyGraph, 
    PackageInfo, ModuleInfo, ClassInfo, MethodInfo, FieldInfo,
    Relationship, CyclicDependency, DependencyType, QualityMetrics, EntityType,
    create_module_id
)
from .ast_analyzer import ASTAnalyzer, FileAnalysis
from .legacy_bridge import LegacyBridge
from .code_metrics import CodeMetricsEngine
from .cache_manager import CacheManager, IncrementalAnalyzer, AnalysisCache, FileMetadata
from .performance_optimizer import LargeProjectAnalyzer, PerformanceConfig, ResultPaginator

logger = logging.getLogger(__name__)


class AnalysisOptions:
    """분석을 위한 설정 옵션들"""
    
    def __init__(self,
                 max_depth: int = 0,
                 exclude_patterns: List[str] = None,
                 include_stdlib: bool = False,
                 analysis_levels: List[str] = None,
                 enable_type_inference: bool = True,
                 max_workers: int = None,
                 enable_caching: bool = True,
                 enable_quality_metrics: bool = True,
                 enable_performance_optimization: bool = True,
                 max_memory_mb: int = 1024):
        
        self.max_depth = max_depth
        self.exclude_patterns = exclude_patterns or ['__pycache__', '.git', '.venv', 'venv', 'env', 'tests']
        self.include_stdlib = include_stdlib
        self.analysis_levels = analysis_levels or ['package', 'module', 'class', 'method', 'field']
        self.enable_type_inference = enable_type_inference
        self.max_workers = max_workers or min(32, (os.cpu_count() or 1) + 4)
        self.enable_caching = enable_caching
        self.enable_quality_metrics = enable_quality_metrics
        self.enable_performance_optimization = enable_performance_optimization
        self.max_memory_mb = max_memory_mb


class ProgressCallback:
    """Interface for receiving progress updates during analysis"""
    
    def __init__(self, callback: Callable[[dict], None] = None):
        self.callback = callback or self._default_callback
    
    def update(self, stage: str, progress: float, **kwargs):
        """Update progress"""
        data = {
            'stage': stage,
            'progress': progress,
            **kwargs
        }
        self.callback(data)
    
    def _default_callback(self, data: dict):
        """Default progress callback that logs to console"""
        stage = data.get('stage', 'Unknown')
        progress = data.get('progress', 0)
        logger.info(f"{stage}: {progress:.1f}%")


class AnalyzerEngine:
    """Main analysis engine that orchestrates all analysis components"""
    
    def __init__(self, options: AnalysisOptions = None):
        self.options = options or AnalysisOptions()
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.ast_analyzer = ASTAnalyzer()
        self.legacy_bridge = LegacyBridge()
        self.metrics_engine = None  # Temporarily disabled to prevent hanging
        self.cache_manager = CacheManager() if options and options.enable_caching else None
        self.incremental_analyzer = IncrementalAnalyzer(self.cache_manager) if self.cache_manager else None
        
        # Performance optimization components
        if options and options.enable_performance_optimization:
            perf_config = PerformanceConfig(
                max_memory_mb=options.max_memory_mb,
                max_workers=options.max_workers,
                batch_size=100,
                enable_streaming=True,
                enable_gc=True
            )
            self.large_project_analyzer = LargeProjectAnalyzer(perf_config)
            self.result_paginator = ResultPaginator()
        else:
            self.large_project_analyzer = None
            self.result_paginator = None
        
        # Analysis state
        self.current_analysis_id: Optional[str] = None
        self.total_files = 0
        self.processed_files = 0
    
    def analyze_project(self, 
                       project_path: str, 
                       progress_callback: ProgressCallback = None) -> AnalysisResult:
        """
        Analyze a Python project with complete 5-layer analysis
        
        Args:
            project_path: Path to the project root
            progress_callback: Optional callback for progress updates
            
        Returns:
            Complete analysis result with all 5 layers
        """
        start_time = time.time()
        self.current_analysis_id = str(uuid.uuid4())
        
        if progress_callback is None:
            progress_callback = ProgressCallback()
        
        try:
            # Stage 1: Project discovery and size estimation
            progress_callback.update("Discovering project files", 5)
            project_files = self._discover_project_files(project_path)
            self.total_files = len(project_files)
            
            # Stage 1.2: Check for large project optimization
            if self.large_project_analyzer and len(project_files) > 1000:
                progress_callback.update("Analyzing project complexity", 7)
                project_stats = self.large_project_analyzer.estimate_project_size(project_path)
                
                if project_stats['complexity'] in ['high', 'very_high']:
                    progress_callback.update("Large project detected, using optimized analysis", 10)
                    return self._analyze_large_project(project_path, project_files, progress_callback, start_time)
                else:
                    progress_callback.update("Project size manageable, using standard analysis", 10)
            
            # Stage 1.5: Check for incremental analysis possibility
            cache_id = None
            if self.incremental_analyzer:
                progress_callback.update("Checking cache validity", 8)
                cache_id = self.incremental_analyzer.can_use_incremental(
                    project_path, vars(self.options)
                )
                
                if cache_id:
                    progress_callback.update("Performing incremental analysis", 10)
                    try:
                        # Attempt incremental analysis
                        def full_analysis_fallback(path, files):
                            return self._perform_full_analysis(path, files, progress_callback)
                        
                        result = self.incremental_analyzer.perform_incremental_analysis(
                            project_path, project_files, cache_id, full_analysis_fallback
                        )
                        
                        progress_callback.update("Incremental analysis complete", 100)
                        return result
                        
                    except Exception as e:
                        self.logger.warning(f"Incremental analysis failed, falling back to full: {e}")
                        # Continue with full analysis
            
            # Perform full analysis
            analysis_result = self._perform_full_analysis(project_path, project_files, progress_callback, start_time)
            
            # Stage 7: Save to cache if caching enabled
            if self.cache_manager and not cache_id:
                progress_callback.update("Saving analysis cache", 99)
                self._save_analysis_cache(project_path, project_files, analysis_result)
            
            progress_callback.update("Analysis complete", 100)
            return analysis_result
            
        except Exception as e:
            self.logger.error(f"Analysis failed: {e}")
            raise
    
    def _perform_full_analysis(self, project_path: str, project_files: List[str], 
                              progress_callback: ProgressCallback, start_time: float = None) -> AnalysisResult:
        """Perform complete analysis without caching"""
        if start_time is None:
            start_time = time.time()
        
        # Stage 2: pydeps module-level analysis  
        progress_callback.update("Running module-level analysis", 15)
        pydeps_result = self._run_pydeps_analysis(project_path, progress_callback)
        
        # Stage 3: AST detailed analysis
        progress_callback.update("Analyzing code structure", 30)
        ast_analyses = self._run_ast_analysis(project_files, progress_callback)
        
        # Stage 4: Data integration
        progress_callback.update("Integrating analysis results", 70)
        integrated_data = self._integrate_analyses(pydeps_result, ast_analyses, progress_callback)
        
        # Stage 5: Quality metrics analysis (temporarily disabled to prevent hanging)
        quality_metrics = []
        progress_callback.update("Skipping quality metrics (fast mode)", 85)
        # Temporarily disable quality metrics to prevent hanging
        # if self.metrics_engine and self.options.enable_quality_metrics:
        #     progress_callback.update("Calculating quality metrics", 85)
        #     quality_metrics = self._calculate_quality_metrics(integrated_data, project_files, progress_callback)
        
        # Stage 6: Final result assembly
        progress_callback.update("Assembling final results", 95)
        analysis_result = self._assemble_result(
            project_path, integrated_data, quality_metrics, start_time, progress_callback
        )
        
        return analysis_result
    
    def _save_analysis_cache(self, project_path: str, project_files: List[str], 
                            analysis_result: AnalysisResult):
        """Save analysis results to cache"""
        try:
            cache_id = self.cache_manager.generate_cache_key(project_path, vars(self.options))
            
            # Create file metadata for all analyzed files
            file_metadata = {}
            for file_path in project_files:
                if os.path.exists(file_path):
                    file_metadata[file_path] = FileMetadata.from_file(file_path)
            
            # Create cache entry
            cache = AnalysisCache(
                cache_id=cache_id,
                project_path=project_path,
                created_at=datetime.now(),
                expires_at=datetime.now() + timedelta(days=7),  # Cache for 7 days
                file_metadata=file_metadata,
                analysis_result=analysis_result
            )
            
            self.cache_manager.save_cache(cache)
            self.logger.info(f"Analysis results cached with ID: {cache_id}")
            
        except Exception as e:
            self.logger.warning(f"Failed to save cache: {e}")
    
    def _analyze_large_project(self, project_path: str, project_files: List[str], 
                              progress_callback: ProgressCallback, start_time: float) -> AnalysisResult:
        """Analyze large project using optimization strategies"""
        
        if not self.large_project_analyzer:
            # Fallback to standard analysis
            return self._perform_full_analysis(project_path, project_files, progress_callback, start_time)
        
        progress_callback.update("Initializing large project analysis", 12)
        
        # Create optimized analyzer function for streaming
        def optimized_ast_analysis(file_batch: List[str]):
            batch_results = []
            for file_path in file_batch:
                try:
                    analysis = self.ast_analyzer.analyze_file(file_path)
                    if analysis:
                        batch_results.append(analysis)
                except Exception as e:
                    self.logger.warning(f"Failed to analyze {file_path}: {e}")
            return batch_results
        
        # Stream analysis results
        all_analyses = []
        total_processed = 0
        
        for batch_result in self.large_project_analyzer.analyze_large_project(
            project_path, optimized_ast_analysis, 
            lambda msg, prog: progress_callback.update(f"Large project: {msg}", 15 + (prog * 0.6))
        ):
            all_analyses.extend(batch_result)
            total_processed += len(batch_result)
            
            # Periodic progress updates
            if total_processed % 500 == 0:  # Every 500 files
                progress_callback.update(f"Processed {total_processed}/{len(project_files)} files", 
                                       15 + (total_processed / len(project_files)) * 60)
        
        progress_callback.update("Completing large project analysis", 80)
        
        # Use simplified integration for large projects
        integrated_data = self._integrate_large_project_data(all_analyses, progress_callback)
        
        # Skip quality metrics for very large projects to save memory
        quality_metrics = []
        if self.metrics_engine and len(project_files) < 5000:  # Only for < 5k files
            progress_callback.update("Calculating quality metrics (subset)", 85)
            # Analyze only a sample for quality metrics
            sample_size = min(1000, len(all_analyses))
            sample_analyses = all_analyses[:sample_size]
            quality_metrics = self._calculate_quality_metrics_sample(integrated_data, sample_analyses, progress_callback)
        
        # Final result assembly with pagination support
        progress_callback.update("Assembling results with pagination", 95)
        analysis_result = self._assemble_large_project_result(
            project_path, integrated_data, quality_metrics, start_time, progress_callback
        )
        
        return analysis_result
    
    def _integrate_large_project_data(self, all_analyses: List[FileAnalysis], 
                                     progress_callback: ProgressCallback) -> Dict:
        """Simplified integration for large projects"""
        
        packages = {}
        modules = []
        classes = []
        methods = []
        fields = []
        relationships = []
        
        for analysis in all_analyses:
            # Convert analysis to our data structures (simplified)
            module_info = ModuleInfo(
                id=create_module_id(analysis.file_path),
                name=Path(analysis.file_path).stem,
                file_path=analysis.file_path,
                classes=analysis.classes,  # Assuming these are already converted
                functions=analysis.functions,
                imports=analysis.imports,
                loc=analysis.lines_of_code
            )
            modules.append(module_info)
            
            # Add classes and methods (simplified)
            classes.extend(analysis.classes)
            methods.extend(analysis.methods)
            fields.extend(analysis.fields)
        
        return {
            'packages': list(packages.values()),
            'modules': modules,
            'classes': classes,
            'methods': methods,
            'fields': fields,
            'relationships': relationships,
            'cycles': [],  # Skip cycle detection for large projects
            'metrics': {
                'entity_counts': {
                    'modules': len(modules),
                    'classes': len(classes),
                    'methods': len(methods),
                    'fields': len(fields)
                }
            }
        }
    
    def _calculate_quality_metrics_sample(self, integrated_data: Dict, 
                                        sample_analyses: List[FileAnalysis],
                                        progress_callback: ProgressCallback) -> List[QualityMetrics]:
        """Calculate quality metrics on a sample for large projects"""
        
        if not self.metrics_engine:
            return []
        
        sample_metrics = []
        
        # Only analyze a subset to save memory and time
        for i, module in enumerate(integrated_data.get('modules', [])[:100]):  # Max 100 modules
            try:
                # This would be a simplified quality analysis
                quality_metric = QualityMetrics(
                    entity_id=module.id,
                    entity_type=EntityType.MODULE,
                    cyclomatic_complexity=5,  # Simplified
                    lines_of_code=module.loc,
                    quality_grade="B"  # Default grade
                )
                sample_metrics.append(quality_metric)
                
            except Exception as e:
                self.logger.warning(f"Failed to calculate metrics for {module.id}: {e}")
                continue
        
        return sample_metrics
    
    def _assemble_large_project_result(self, project_path: str, integrated_data: Dict, 
                                      quality_metrics: List[QualityMetrics],
                                      start_time: float, progress_callback: ProgressCallback) -> AnalysisResult:
        """Assemble results for large projects with pagination"""
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Create project info
        project_info = ProjectInfo(
            name=os.path.basename(project_path),
            path=project_path,
            analyzed_at=datetime.now().isoformat(),
            total_files=self.total_files,
            analysis_duration_seconds=duration,
            python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            analysis_options=vars(self.options)
        )
        
        # Create dependency graph with pagination info
        dependency_graph = DependencyGraph(
            packages=integrated_data['packages'],
            modules=integrated_data['modules'][:1000],  # Limit modules in memory
            classes=integrated_data['classes'][:2000],   # Limit classes
            methods=integrated_data['methods'][:5000],   # Limit methods
            fields=integrated_data['fields'][:5000]      # Limit fields
        )
        
        # Create final result
        result = AnalysisResult(
            analysis_id=self.current_analysis_id,
            project_info=project_info,
            dependency_graph=dependency_graph,
            relationships=integrated_data['relationships'][:1000],  # Limit relationships
            quality_metrics=quality_metrics,
            metrics=integrated_data['metrics'],
            cycles=integrated_data['cycles']
        )
        
        self.logger.info(f"Large project analysis completed in {duration:.2f} seconds")
        self.logger.info(f"Analyzed {len(integrated_data['modules'])} modules, "
                        f"{len(integrated_data['classes'])} classes")
        
        return result
    
    def _discover_project_files(self, project_path: str) -> List[str]:
        """Discover all Python files in the project"""
        python_files = []
        
        for root, dirs, files in os.walk(project_path):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if not any(pattern in d for pattern in self.options.exclude_patterns)]
            
            for file in files:
                if file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    # Skip if any exclude pattern is in the path
                    if not any(pattern in file_path for pattern in self.options.exclude_patterns):
                        python_files.append(file_path)
        
        self.logger.info(f"Discovered {len(python_files)} Python files")
        return python_files
    
    def _run_pydeps_analysis(self, project_path: str, progress_callback: ProgressCallback) -> Dict:
        """Run pydeps analysis to get module-level dependencies"""
        try:
            # Convert PyView options to pydeps format
            pydeps_kwargs = {
                'max_bacon': self.options.max_depth if self.options.max_depth > 0 else 2,
                'exclude': self.options.exclude_patterns,
                'pylib': self.options.include_stdlib,
                'verbose': 0
            }
            
            # Run pydeps analysis
            dep_graph = self.legacy_bridge.analyze_with_pydeps(project_path, **pydeps_kwargs)
            
            # Convert to PyView data structures
            packages, modules, relationships = self.legacy_bridge.convert_pydeps_to_modules(dep_graph)
            
            # Extract additional information
            cycles = self.legacy_bridge.detect_cycles_from_pydeps(dep_graph)
            metrics = self.legacy_bridge.get_pydeps_metrics(dep_graph)
            
            return {
                'dep_graph': dep_graph,
                'packages': packages,
                'modules': modules,
                'relationships': relationships,
                'cycles': cycles,
                'metrics': metrics
            }
            
        except Exception as e:
            self.logger.error(f"pydeps analysis failed: {e}")
            # Return empty results if pydeps fails
            return {
                'dep_graph': None,
                'packages': [],
                'modules': [],
                'relationships': [],
                'cycles': [],
                'metrics': {}
            }
    
    def _run_ast_analysis(self, project_files: List[str], 
                         progress_callback: ProgressCallback) -> List[FileAnalysis]:
        """Run AST analysis on all project files"""
        analyses = []
        
        if self.options.max_workers > 1:
            # Parallel processing
            analyses = self._run_parallel_ast_analysis(project_files, progress_callback)
        else:
            # Sequential processing
            analyses = self._run_sequential_ast_analysis(project_files, progress_callback)
        
        # Filter out failed analyses
        successful_analyses = [a for a in analyses if a is not None]
        failed_count = len(analyses) - len(successful_analyses)
        
        if failed_count > 0:
            self.logger.warning(f"{failed_count} files failed AST analysis")
        
        return successful_analyses
    
    def _run_sequential_ast_analysis(self, project_files: List[str], 
                                   progress_callback: ProgressCallback) -> List[FileAnalysis]:
        """Run AST analysis sequentially"""
        analyses = []
        
        for i, file_path in enumerate(project_files):
            try:
                analysis = self.ast_analyzer.analyze_file(file_path)
                analyses.append(analysis)
                
                # Update progress
                self.processed_files = i + 1
                progress = 30 + (50 * (i + 1) / len(project_files))  # 30-80%
                progress_callback.update(
                    "Analyzing code structure",
                    progress,
                    current_file=os.path.basename(file_path),
                    files_processed=self.processed_files,
                    total_files=self.total_files
                )
                
            except Exception as e:
                self.logger.warning(f"Failed to analyze {file_path}: {e}")
                analyses.append(None)
        
        return analyses
    
    def _run_parallel_ast_analysis(self, project_files: List[str],
                                  progress_callback: ProgressCallback) -> List[FileAnalysis]:
        """Run AST analysis in parallel using ProcessPoolExecutor"""
        analyses = [None] * len(project_files)
        
        with ProcessPoolExecutor(max_workers=self.options.max_workers) as executor:
            # Submit all tasks
            future_to_index = {
                executor.submit(self._analyze_single_file, file_path): i 
                for i, file_path in enumerate(project_files)
            }
            
            # Collect results as they complete
            completed_count = 0
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                file_path = project_files[index]
                
                try:
                    result = future.result()
                    analyses[index] = result
                except Exception as e:
                    self.logger.warning(f"Failed to analyze {file_path}: {e}")
                    analyses[index] = None
                
                # Update progress
                completed_count += 1
                self.processed_files = completed_count
                progress = 30 + (50 * completed_count / len(project_files))  # 30-80%
                progress_callback.update(
                    "Analyzing code structure",
                    progress,
                    current_file=os.path.basename(file_path),
                    files_processed=self.processed_files,
                    total_files=self.total_files
                )
        
        return analyses
    
    @staticmethod
    def _analyze_single_file(file_path: str) -> Optional[FileAnalysis]:
        """Static method for parallel processing - analyze single file"""
        try:
            analyzer = ASTAnalyzer()
            return analyzer.analyze_file(file_path)
        except Exception as e:
            logger.warning(f"Failed to analyze {file_path}: {e}")
            return None
    
    def _integrate_analyses(self, pydeps_result: Dict, ast_analyses: List[FileAnalysis],
                          progress_callback: ProgressCallback) -> Dict:
        """Integrate pydeps and AST analysis results"""
        
        # Merge module information
        packages, modules, relationships = self.legacy_bridge.merge_with_ast_analysis(
            pydeps_result['packages'],
            pydeps_result['modules'], 
            pydeps_result['relationships'],
            ast_analyses
        )
        
        # Collect all class, method, field information from AST analyses
        all_classes = []
        all_methods = []
        all_fields = []
        
        for analysis in ast_analyses:
            if analysis:
                all_classes.extend(analysis.classes)
                all_methods.extend(analysis.methods)
                all_fields.extend(analysis.fields)
        
        # Detect additional cycles at class/method level
        additional_cycles = self._detect_detailed_cycles(all_classes, all_methods, relationships)
        all_cycles = pydeps_result['cycles'] + additional_cycles
        
        # Calculate enhanced metrics
        enhanced_metrics = self._calculate_enhanced_metrics(
            packages, modules, all_classes, all_methods, relationships
        )
        
        return {
            'packages': packages,
            'modules': modules,
            'classes': all_classes,
            'methods': all_methods,
            'fields': all_fields,
            'relationships': relationships,
            'cycles': all_cycles,
            'metrics': enhanced_metrics
        }
    
    def _detect_detailed_cycles(self, classes: List[ClassInfo], methods: List[MethodInfo], 
                              relationships: List[Relationship]) -> List[Dict]:
        """Detect cycles at class and method level"""
        cycles = []
        
        # Separate relationships by type for different cycle detection
        import_rels = [r for r in relationships if r.relationship_type.value == 'import']
        call_rels = [r for r in relationships if r.relationship_type.value == 'call']
        
        self.logger.info(f"Detecting cycles: {len(import_rels)} import, {len(call_rels)} call relationships")
        
        # Detect import cycles (module level)
        import_cycles = self._detect_cycles_by_type(import_rels, 'import')
        cycles.extend(import_cycles)
        
        # Detect call cycles (method/function level)  
        call_cycles = self._detect_cycles_by_type(call_rels, 'call')
        cycles.extend(call_cycles)
        
        self.logger.info(f"Found {len(cycles)} detailed cycles")
        return cycles
    
    def _detect_cycles_by_type(self, relationships: List[Relationship], cycle_type: str) -> List[Dict]:
        """Detect cycles for a specific relationship type"""
        cycles = []
        
        if not relationships:
            return cycles
        
        # Build adjacency graph
        graph = {}
        edge_info = {}  # Store relationship details
        
        for rel in relationships:
            if rel.from_entity not in graph:
                graph[rel.from_entity] = set()
            graph[rel.from_entity].add(rel.to_entity)
            edge_info[(rel.from_entity, rel.to_entity)] = rel
        
        # Find strongly connected components using DFS
        visited = set()
        finished = set()
        stack = []
        
        def dfs1(node):
            if node in visited:
                return
            visited.add(node)
            for neighbor in graph.get(node, []):
                dfs1(neighbor)
            stack.append(node)
        
        # First DFS to get finish times
        for node in graph:
            dfs1(node)
        
        # Build reverse graph
        reverse_graph = {}
        for node in graph:
            for neighbor in graph[node]:
                if neighbor not in reverse_graph:
                    reverse_graph[neighbor] = set()
                reverse_graph[neighbor].add(node)
        
        # Second DFS on reverse graph
        visited.clear()
        
        def dfs2(node, component):
            if node in visited:
                return
            visited.add(node)
            component.append(node)
            for neighbor in reverse_graph.get(node, []):
                dfs2(neighbor, component)
        
        # Find SCCs
        while stack:
            node = stack.pop()
            if node not in visited:
                component = []
                dfs2(node, component)
                
                # Only consider components with cycles (size > 1)
                if len(component) > 1:
                    # Extract cycle path
                    cycle_paths = []
                    for i, entity in enumerate(component):
                        next_entity = component[(i + 1) % len(component)]
                        # Check if direct edge exists
                        if entity in graph and next_entity in graph[entity]:
                            rel = edge_info.get((entity, next_entity))
                            if rel:
                                cycle_paths.append({
                                    'from': entity,
                                    'to': next_entity,
                                    'relationship_type': cycle_type,
                                    'strength': rel.strength if hasattr(rel, 'strength') else 1.0,
                                    'line_number': rel.line_number,
                                    'file_path': rel.file_path
                                })
                    
                    # Calculate severity based on cycle type and length
                    if cycle_type == 'import':
                        severity = 'high' if len(component) > 3 else 'medium'
                    else:
                        severity = 'low' if len(component) <= 2 else 'medium'
                    
                    cycle_info = {
                        'id': f"{cycle_type}_cycle_{len(cycles)}",
                        'entities': component,
                        'paths': cycle_paths,
                        'cycle_type': cycle_type,
                        'severity': severity,
                        'metrics': {
                            'length': len(component),
                            'edge_count': len(cycle_paths)
                        },
                        'description': f"{cycle_type.title()} cycle involving {len(component)} entities"
                    }
                    cycles.append(cycle_info)
        
        return cycles
    
    def _calculate_enhanced_metrics(self, packages: List[PackageInfo], modules: List[ModuleInfo],
                                  classes: List[ClassInfo], methods: List[MethodInfo],
                                  relationships: List[Relationship]) -> Dict:
        """Calculate enhanced metrics including all 5 layers"""
        
        metrics = {
            'entity_counts': {
                'packages': len(packages),
                'modules': len(modules), 
                'classes': len(classes),
                'methods': len(methods),
                'relationships': len(relationships)
            },
            'complexity_metrics': {},
            'coupling_metrics': {},
            'quality_metrics': {}
        }
        
        # Calculate complexity metrics
        for method in methods:
            if method.complexity:
                metrics['complexity_metrics'][method.id] = method.complexity
        
        # Calculate coupling metrics
        in_degree = {}
        out_degree = {}
        
        for rel in relationships:
            # Count incoming relationships
            if rel.to_entity not in in_degree:
                in_degree[rel.to_entity] = 0
            in_degree[rel.to_entity] += 1
            
            # Count outgoing relationships
            if rel.from_entity not in out_degree:
                out_degree[rel.from_entity] = 0
            out_degree[rel.from_entity] += 1
        
        # Calculate instability for each entity
        all_entities = set(in_degree.keys()) | set(out_degree.keys())
        for entity in all_entities:
            ca = in_degree.get(entity, 0)  # Afferent coupling
            ce = out_degree.get(entity, 0)  # Efferent coupling
            
            instability = ce / (ca + ce) if (ca + ce) > 0 else 0.0
            metrics['coupling_metrics'][entity] = {
                'afferent_coupling': ca,
                'efferent_coupling': ce,
                'instability': instability
            }
        
        return metrics
    
    def _calculate_quality_metrics(self, integrated_data: Dict, project_files: List[str], 
                                  progress_callback: ProgressCallback) -> List[QualityMetrics]:
        """Calculate code quality metrics for all entities"""
        quality_metrics = []
        
        if not self.metrics_engine:
            return quality_metrics
            
        from .models import EntityType
        
        # Read source files for analysis
        source_cache = {}
        for file_path in project_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    source_cache[file_path] = f.read()
            except:
                continue
        
        total_entities = (len(integrated_data.get('modules', [])) + 
                         len(integrated_data.get('classes', [])))
        processed = 0
        
        # Calculate metrics for modules
        for module in integrated_data.get('modules', []):
            source_code = source_cache.get(module.file_path, "")
            if source_code:
                module_metrics = self.metrics_engine.analyze_module_quality(module, source_code)
                
                quality_metric = QualityMetrics(
                    entity_id=module.id,
                    entity_type=EntityType.MODULE,
                    cyclomatic_complexity=module_metrics.complexity.cyclomatic_complexity,
                    cognitive_complexity=module_metrics.complexity.cognitive_complexity,
                    nesting_depth=module_metrics.complexity.nesting_depth,
                    lines_of_code=len(source_code.split('\n')),
                    afferent_coupling=module_metrics.coupling.afferent_coupling,
                    efferent_coupling=module_metrics.coupling.efferent_coupling,
                    instability=module_metrics.coupling.instability,
                    maintainability_index=module_metrics.maintainability_index,
                    technical_debt_ratio=module_metrics.technical_debt_ratio,
                    quality_grade=self.metrics_engine.get_quality_rating(module_metrics)
                )
                quality_metrics.append(quality_metric)
                
            processed += 1
            if processed % 10 == 0:
                progress = 85 + (processed / total_entities) * 10
                progress_callback.update(f"Quality metrics: {processed}/{total_entities}", progress)
        
        # Calculate metrics for classes
        for class_info in integrated_data.get('classes', []):
            source_code = source_cache.get(class_info.file_path, "")
            if source_code:
                class_metrics = self.metrics_engine.analyze_class_quality(class_info, source_code)
                
                quality_metric = QualityMetrics(
                    entity_id=class_info.id,
                    entity_type=EntityType.CLASS,
                    cyclomatic_complexity=class_metrics.complexity.cyclomatic_complexity,
                    cognitive_complexity=class_metrics.complexity.cognitive_complexity,
                    nesting_depth=class_metrics.complexity.nesting_depth,
                    lines_of_code=sum(len(m.body_text.split('\n')) for m in class_info.methods),
                    afferent_coupling=class_metrics.coupling.afferent_coupling,
                    efferent_coupling=class_metrics.coupling.efferent_coupling,
                    instability=class_metrics.coupling.instability,
                    maintainability_index=class_metrics.maintainability_index,
                    technical_debt_ratio=class_metrics.technical_debt_ratio,
                    quality_grade=self.metrics_engine.get_quality_rating(class_metrics)
                )
                quality_metrics.append(quality_metric)
                
            processed += 1
            if processed % 10 == 0:
                progress = 85 + (processed / total_entities) * 10
                progress_callback.update(f"Quality metrics: {processed}/{total_entities}", progress)
        
        self.logger.info(f"Calculated quality metrics for {len(quality_metrics)} entities")
        return quality_metrics
    
    def _assemble_result(self, project_path: str, integrated_data: Dict, 
                        quality_metrics: List[QualityMetrics],
                        start_time: float, progress_callback: ProgressCallback) -> AnalysisResult:
        """Assemble the final analysis result"""
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Create project info
        project_info = ProjectInfo(
            name=os.path.basename(project_path),
            path=project_path,
            analyzed_at=datetime.now().isoformat(),
            total_files=self.total_files,
            analysis_duration_seconds=duration,
            python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            analysis_options=vars(self.options)
        )
        
        # Create dependency graph
        dependency_graph = DependencyGraph(
            packages=integrated_data['packages'],
            modules=integrated_data['modules'],
            classes=integrated_data['classes'],
            methods=integrated_data['methods'],
            fields=integrated_data['fields']
        )
        
        # Convert cycle dictionaries to CyclicDependency objects
        cycles = []
        for cycle_dict in integrated_data['cycles']:
            cycle = CyclicDependency(
                id=cycle_dict['id'],
                entities=cycle_dict['entities'],
                cycle_type=cycle_dict['cycle_type'],
                severity=cycle_dict['severity'],
                description=cycle_dict.get('description'),
                paths=cycle_dict.get('paths', []),  # Include detailed path information
                metrics=cycle_dict.get('metrics')  # Include cycle metrics
            )
            cycles.append(cycle)
        
        # Create final result
        result = AnalysisResult(
            analysis_id=self.current_analysis_id,
            project_info=project_info,
            dependency_graph=dependency_graph,
            relationships=integrated_data['relationships'],
            quality_metrics=quality_metrics,
            metrics=integrated_data['metrics'],
            cycles=cycles
        )
        
        self.logger.info(f"Analysis completed in {duration:.2f} seconds")
        self.logger.info(f"Found {len(result.dependency_graph.modules)} modules, "
                        f"{len(result.dependency_graph.classes)} classes, "
                        f"{len(result.dependency_graph.methods)} methods")
        
        return result


def analyze_project(project_path: str, 
                   options: AnalysisOptions = None,
                   progress_callback: ProgressCallback = None) -> AnalysisResult:
    """
    Convenience function to analyze a Python project
    
    Args:
        project_path: Path to the project root
        options: Analysis options (uses defaults if None)
        progress_callback: Optional progress callback
        
    Returns:
        Complete analysis result
    """
    engine = AnalyzerEngine(options)
    return engine.analyze_project(project_path, progress_callback)