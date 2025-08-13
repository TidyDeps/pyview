"""
PyView Unified Analysis Engine

Combines pydeps module-level analysis with AST-based class/method/field analysis
to provide complete 5-layer dependency analysis.
"""

import os
import sys
import uuid
import time
import logging
from pathlib import Path
from typing import List, Dict, Set, Optional, Callable, Any
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed

from .models import (
    AnalysisResult, ProjectInfo, DependencyGraph, 
    PackageInfo, ModuleInfo, ClassInfo, MethodInfo, FieldInfo,
    Relationship, CyclicDependency, DependencyType,
    create_module_id
)
from .ast_analyzer import ASTAnalyzer, FileAnalysis
from .legacy_bridge import LegacyBridge

logger = logging.getLogger(__name__)


class AnalysisOptions:
    """Configuration options for analysis"""
    
    def __init__(self,
                 max_depth: int = 0,
                 exclude_patterns: List[str] = None,
                 include_stdlib: bool = False,
                 analysis_levels: List[str] = None,
                 enable_type_inference: bool = True,
                 max_workers: int = None,
                 enable_caching: bool = True):
        
        self.max_depth = max_depth
        self.exclude_patterns = exclude_patterns or ['__pycache__', '.git', '.venv', 'venv', 'env', 'tests']
        self.include_stdlib = include_stdlib
        self.analysis_levels = analysis_levels or ['package', 'module', 'class', 'method', 'field']
        self.enable_type_inference = enable_type_inference
        self.max_workers = max_workers or min(32, (os.cpu_count() or 1) + 4)
        self.enable_caching = enable_caching


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
            # Stage 1: Project discovery
            progress_callback.update("Discovering project files", 5)
            project_files = self._discover_project_files(project_path)
            self.total_files = len(project_files)
            
            # Stage 2: pydeps module-level analysis  
            progress_callback.update("Running module-level analysis", 15)
            pydeps_result = self._run_pydeps_analysis(project_path, progress_callback)
            
            # Stage 3: AST detailed analysis
            progress_callback.update("Analyzing code structure", 30)
            ast_analyses = self._run_ast_analysis(project_files, progress_callback)
            
            # Stage 4: Data integration
            progress_callback.update("Integrating analysis results", 80)
            integrated_data = self._integrate_analyses(pydeps_result, ast_analyses, progress_callback)
            
            # Stage 5: Final result assembly
            progress_callback.update("Assembling final results", 95)
            analysis_result = self._assemble_result(
                project_path, integrated_data, start_time, progress_callback
            )
            
            progress_callback.update("Analysis complete", 100)
            
            return analysis_result
            
        except Exception as e:
            self.logger.error(f"Analysis failed: {e}")
            raise
    
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
        
        # Build adjacency graph from relationships
        graph = {}
        for rel in relationships:
            if rel.from_entity not in graph:
                graph[rel.from_entity] = set()
            graph[rel.from_entity].add(rel.to_entity)
        
        # Simple cycle detection using DFS
        visited = set()
        rec_stack = set()
        
        def has_cycle(node, path):
            if node in rec_stack:
                # Found cycle, extract it
                cycle_start = path.index(node)
                cycle_entities = path[cycle_start:] + [node]
                return cycle_entities
            
            if node in visited:
                return None
            
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in graph.get(node, []):
                cycle = has_cycle(neighbor, path)
                if cycle:
                    return cycle
            
            rec_stack.remove(node)
            path.pop()
            return None
        
        # Check for cycles starting from each node
        for node in graph:
            if node not in visited:
                cycle = has_cycle(node, [])
                if cycle:
                    cycle_info = {
                        'id': f"detailed_cycle_{len(cycles)}",
                        'entities': cycle,
                        'cycle_type': 'call',  # Most detailed cycles are method calls
                        'severity': 'low' if len(cycle) <= 2 else 'medium',
                        'description': f"Call cycle involving {len(cycle)} entities"
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
    
    def _assemble_result(self, project_path: str, integrated_data: Dict, 
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
                description=cycle_dict.get('description')
            )
            cycles.append(cycle)
        
        # Create final result
        result = AnalysisResult(
            analysis_id=self.current_analysis_id,
            project_info=project_info,
            dependency_graph=dependency_graph,
            relationships=integrated_data['relationships'],
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