"""
PyView 레거시 브리지

기존 pydeps 기능과 PyView의 5단계 분석을 연결.
pydeps DepGraph 결과를 PyView 데이터 모델로 변환.
"""

import os
import sys
import logging
from typing import List, Dict, Set, Optional, Tuple
from pathlib import Path

# 기존 pydeps 모듈들 import
from pydeps.depgraph import DepGraph, Source
from pydeps import py2depgraph
from pydeps.target import Target

from .models import (
    ModuleInfo, PackageInfo, Relationship, DependencyType,
    ImportInfo, create_module_id, create_package_id, 
    create_relationship_id
)
from .ast_analyzer import FileAnalysis

logger = logging.getLogger(__name__)


class LegacyBridge:
    """기존 pydeps와 PyView 데이터 모델 사이의 브리지"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def analyze_with_pydeps(self, project_path: str, **kwargs) -> DepGraph:
        """Run pydeps analysis on a project"""
        try:
            # Create target for pydeps analysis
            target = Target(project_path)
            
            # Run pydeps analysis
            dep_graph = py2depgraph.py2dep(target, **kwargs)
            
            return dep_graph
            
        except Exception as e:
            self.logger.error(f"pydeps analysis failed: {e}")
            raise
    
    def convert_pydeps_to_modules(self, dep_graph: DepGraph) -> Tuple[List[PackageInfo], List[ModuleInfo], List[Relationship]]:
        """Convert pydeps DepGraph to PyView modules and packages"""
        packages = []
        modules = []
        relationships = []
        
        # Track packages we've seen
        seen_packages: Set[str] = set()
        package_modules: Dict[str, List[str]] = {}
        
        # Convert sources to modules
        for source in dep_graph.sources.values():
            if source.excluded or source.is_noise():
                continue
            
            # Create module info
            module_info = self._convert_source_to_module(source)
            modules.append(module_info)
            
            # Extract package info
            package_name = self._extract_package_name(source)
            if package_name and package_name not in seen_packages:
                package_info = self._create_package_info(package_name, source)
                packages.append(package_info)
                seen_packages.add(package_name)
                package_modules[package_name] = []
            
            # Associate module with package
            if package_name:
                package_modules[package_name].append(module_info.id)
                module_info.package_id = create_package_id(package_name)
        
        # Update package module lists
        for package in packages:
            package_name = package.name
            if package_name in package_modules:
                package.modules = package_modules[package_name]
        
        # Convert dependencies to relationships
        relationships = self._convert_dependencies_to_relationships(dep_graph)
        
        return packages, modules, relationships
    
    def _convert_source_to_module(self, source: Source) -> ModuleInfo:
        """Convert pydeps Source to PyView ModuleInfo"""
        module_id = create_module_id(source.name)
        
        # Convert pydeps imports to ImportInfo objects
        import_infos = []
        for imported_module in source.imports:
            import_info = ImportInfo(
                module=imported_module,
                import_type="import",
                line_number=0  # pydeps doesn't provide line numbers
            )
            import_infos.append(import_info)
        
        return ModuleInfo(
            id=module_id,
            name=source.name,
            file_path=source.path or "",
            classes=[],  # Will be populated by AST analysis
            functions=[],  # Will be populated by AST analysis
            imports=import_infos,  # Use pydeps import information
            loc=0,  # Will be calculated later
            display_label=source.get_label(splitlength=20),  # Add visualization label
            module_depth=source.module_depth,  # Add module depth info
            degree=source.degree  # Add connectivity degree
        )
    
    def _extract_package_name(self, source: Source) -> Optional[str]:
        """Extract package name from Source object using name_parts"""
        if source.module_depth > 0:
            return source.name_parts[0]
        return None
    
    def _create_package_info(self, package_name: str, sample_source: Source) -> PackageInfo:
        """Create PackageInfo from package name and sample source using path_parts"""
        package_id = create_package_id(package_name)
        
        # Try to determine package path using path_parts
        package_path = ""
        if sample_source.path and sample_source.path_parts:
            # Use path_parts for more efficient package path finding
            for i, part in enumerate(sample_source.path_parts):
                if part == package_name:
                    package_path = "/".join(sample_source.path_parts[:i+1])
                    break
        
        return PackageInfo(
            id=package_id,
            name=package_name,
            path=package_path,
            modules=[],  # Will be populated later
            sub_packages=[]
        )
    
    def _convert_dependencies_to_relationships(self, dep_graph: DepGraph) -> List[Relationship]:
        """Convert pydeps dependencies to PyView relationships"""
        relationships = []
        
        for source in dep_graph.sources.values():
            if source.excluded or source.is_noise():
                continue
            
            from_module_id = create_module_id(source.name)
            
            # Convert imports to relationships
            for imported_name in source.imports:
                if imported_name in dep_graph.sources:
                    imported_source = dep_graph.sources[imported_name]
                    if not imported_source.excluded:
                        to_module_id = create_module_id(imported_name)
                        
                        relationship = Relationship(
                            id=create_relationship_id(from_module_id, to_module_id, DependencyType.IMPORT),
                            from_entity=from_module_id,
                            to_entity=to_module_id,
                            relationship_type=DependencyType.IMPORT,
                            line_number=0,  # pydeps doesn't provide line numbers
                            file_path=source.path or "",
                            strength=1.0
                        )
                        relationships.append(relationship)
        
        return relationships
    
    def merge_with_ast_analysis(self, 
                               packages: List[PackageInfo],
                               modules: List[ModuleInfo], 
                               pydeps_relationships: List[Relationship],
                               ast_analyses: List[FileAnalysis]) -> Tuple[List[PackageInfo], List[ModuleInfo], List[Relationship]]:
        """Merge pydeps results with AST analysis results"""
        
        # Create lookup maps
        module_map = {mod.name: mod for mod in modules}
        ast_map = {self._normalize_module_name(analysis.module_info.name): analysis 
                  for analysis in ast_analyses}
        
        merged_modules = []
        all_relationships = list(pydeps_relationships)
        
        # Merge module information
        for module in modules:
            merged_module = self._merge_module_info(module, ast_map.get(module.name))
            merged_modules.append(merged_module)
        
        # Add AST relationships
        for analysis in ast_analyses:
            all_relationships.extend(analysis.relationships)
        
        # Add modules that were only found by AST analysis
        for ast_name, analysis in ast_map.items():
            if ast_name not in module_map:
                # This module was not found by pydeps, add it
                merged_modules.append(analysis.module_info)
                all_relationships.extend(analysis.relationships)
        
        return packages, merged_modules, all_relationships
    
    def _merge_module_info(self, pydeps_module: ModuleInfo, 
                          ast_analysis: Optional[FileAnalysis]) -> ModuleInfo:
        """Merge pydeps module info with AST analysis"""
        if not ast_analysis:
            return pydeps_module
        
        # Use AST analysis data to enrich pydeps module
        merged = ModuleInfo(
            id=pydeps_module.id,
            name=pydeps_module.name,
            file_path=ast_analysis.module_info.file_path or pydeps_module.file_path,
            package_id=pydeps_module.package_id,
            classes=ast_analysis.module_info.classes,
            functions=ast_analysis.module_info.functions,
            imports=ast_analysis.module_info.imports,
            loc=ast_analysis.module_info.loc,
            docstring=ast_analysis.module_info.docstring,
            display_label=getattr(pydeps_module, 'display_label', pydeps_module.name),
            module_depth=getattr(pydeps_module, 'module_depth', 0),
            degree=getattr(pydeps_module, 'degree', 0)
        )
        
        return merged
    
    def _normalize_module_name(self, module_name: str) -> str:
        """Normalize module name for comparison"""
        # Remove file extensions and normalize path separators
        normalized = module_name.replace('/', '.').replace('\\', '.')
        if normalized.endswith('.py'):
            normalized = normalized[:-3]
        return normalized
    
    def extract_import_info(self, dep_graph: DepGraph) -> Dict[str, List[ImportInfo]]:
        """Extract import information from pydeps DepGraph"""
        imports_by_module = {}
        
        for source in dep_graph.sources.values():
            if source.excluded:
                continue
            
            import_infos = []
            for imported_name in source.imports:
                # Create basic import info (pydeps doesn't distinguish import types)
                import_info = ImportInfo(
                    module=imported_name,
                    import_type="import",
                    line_number=0  # Not available from pydeps
                )
                import_infos.append(import_info)
            
            imports_by_module[source.name] = import_infos
        
        return imports_by_module
    
    def detect_cycles_from_pydeps(self, dep_graph: DepGraph) -> List[Dict]:
        """Extract cycle information from pydeps analysis with detailed path info"""
        cycles = []
        
        if hasattr(dep_graph, 'cycles') and dep_graph.cycles:
            for i, cycle in enumerate(dep_graph.cycles):
                # Extract detailed cycle path information
                cycle_paths = []
                cycle_entities = []
                cycle_strengths = []
                
                for j, source in enumerate(cycle):
                    cycle_entities.append(create_module_id(source.name))
                    
                    # Find relationship to next module in cycle
                    next_source = cycle[(j + 1) % len(cycle)]
                    next_module_name = next_source.name
                    
                    # Check if there's an import relationship
                    if next_module_name in source.imports:
                        # Calculate relationship strength based on coupling metrics
                        strength = self._calculate_relationship_strength(source, next_source)
                        
                        cycle_paths.append({
                            'from': create_module_id(source.name),
                            'to': create_module_id(next_module_name),
                            'relationship_type': 'import',
                            'strength': strength,
                            'source_info': {
                                'path': source.path,
                                'bacon_distance': source.bacon,
                                'total_imports': len(source.imports),
                                'imported_by_count': len(source.imported_by)
                            }
                        })
                        cycle_strengths.append(strength)
                
                # Calculate cycle severity based on length and coupling strength
                avg_strength = sum(cycle_strengths) / len(cycle_strengths) if cycle_strengths else 1.0
                if len(cycle) <= 2:
                    severity = 'low' if avg_strength < 2.0 else 'medium'
                elif len(cycle) <= 4:
                    severity = 'medium' if avg_strength < 3.0 else 'high'
                else:
                    severity = 'high'
                
                cycle_info = {
                    'id': f"cycle_{i}",
                    'entities': cycle_entities,
                    'paths': cycle_paths,  # Detailed import path information
                    'cycle_type': 'import',
                    'severity': severity,
                    'metrics': {
                        'length': len(cycle),
                        'average_strength': avg_strength,
                        'total_coupling': sum(cycle_strengths)
                    },
                    'description': f"Import cycle involving {len(cycle)} modules with {avg_strength:.1f} avg strength"
                }
                cycles.append(cycle_info)
        
        return cycles
    
    def _calculate_relationship_strength(self, source: Source, target: Source) -> float:
        """Calculate relationship strength based on coupling metrics using Source properties"""
        # Base strength
        strength = 1.0
        
        # Factor in source's total imports using in_degree property
        if source.in_degree > 0:
            strength *= (1.0 + 1.0 / source.in_degree)
        
        # Factor in target's incoming dependencies using out_degree property
        if target.out_degree > 0:
            strength *= (1.0 + target.out_degree * 0.1)
        
        # Factor in proximity using name_parts (more efficient than split)
        common_prefix_len = 0
        for s_part, t_part in zip(source.name_parts, target.name_parts):
            if s_part == t_part:
                common_prefix_len += 1
            else:
                break
        
        # Same package = stronger relationship
        if common_prefix_len > 0:
            strength *= (1.0 + common_prefix_len * 0.5)
        
        # Factor in module depth difference (same depth = stronger relationship)
        depth_diff = abs(source.module_depth - target.module_depth)
        if depth_diff == 0:
            strength *= 1.2  # Same depth bonus
        elif depth_diff == 1:
            strength *= 1.1  # Adjacent depth bonus
        
        return min(strength, 5.0)  # Cap at 5.0
    
    def get_pydeps_metrics(self, dep_graph: DepGraph) -> Dict:
        """Extract metrics from pydeps analysis"""
        # Filter out excluded and noise modules for accurate metrics
        valid_sources = [s for s in dep_graph.sources.values() if not s.excluded and not s.is_noise()]
        
        metrics = {
            'total_modules': len(valid_sources),
            'total_relationships': sum(s.in_degree for s in valid_sources),
            'cycles_found': len(dep_graph.cycles) if hasattr(dep_graph, 'cycles') else 0,
            'average_degree': sum(s.degree for s in valid_sources) / len(valid_sources) if valid_sources else 0,
        }
        
        # Calculate coupling metrics using Source properties
        coupling_metrics = {}
        for source in valid_sources:
            module_id = create_module_id(source.name)
            coupling_metrics[module_id] = {
                'efferent_coupling': source.in_degree,  # Use property instead of len()
                'afferent_coupling': source.out_degree,  # Use property instead of len()
                'instability': self._calculate_instability(source),
                'total_degree': source.degree,
                'module_depth': source.module_depth
            }
        
        metrics['coupling_metrics'] = coupling_metrics
        return metrics
    
    def _calculate_instability(self, source: Source) -> float:
        """Calculate instability metric I = Ce / (Ca + Ce)"""
        ce = len(source.imports)  # Efferent coupling
        ca = len(source.imported_by)  # Afferent coupling
        
        if ca + ce == 0:
            return 0.0
        
        return ce / (ca + ce)


class PyDepsCompatibility:
    """Maintains compatibility with existing pydeps CLI interface"""
    
    @staticmethod
    def convert_pydeps_args(**kwargs) -> Dict:
        """Convert pydeps arguments to PyView analysis options"""
        options = {}
        
        # Map pydeps arguments to PyView options
        if 'max_bacon' in kwargs:
            options['max_depth'] = kwargs['max_bacon']
        
        if 'exclude' in kwargs:
            options['exclude_patterns'] = kwargs['exclude']
        
        if 'pylib' in kwargs:
            options['include_stdlib'] = kwargs['pylib']
        
        if 'max_module_depth' in kwargs:
            options['max_module_depth'] = kwargs['max_module_depth']
        
        # Default PyView-specific options
        options.setdefault('analysis_levels', ['package', 'module', 'class', 'method', 'field'])
        options.setdefault('enable_type_inference', True)
        
        return options
    
    @staticmethod
    def create_pydeps_compatible_output(analysis_result) -> Dict:
        """Create output compatible with pydeps format"""
        # This would be used for CLI compatibility
        # Return a simplified format that matches pydeps output
        return {
            'modules': [mod.name for mod in analysis_result.dependency_graph.modules],
            'relationships': [
                {'from': rel.from_entity, 'to': rel.to_entity, 'type': rel.relationship_type.value}
                for rel in analysis_result.relationships
            ]
        }