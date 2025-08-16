"""
PyView Code Quality Metrics

Implements code quality metrics including:
- Cyclomatic Complexity
- Coupling metrics
- Cohesion metrics
- Maintainability Index
"""

import ast
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Any
from pathlib import Path
import math

from .models import MethodInfo, ClassInfo, ModuleInfo


@dataclass
class ComplexityMetrics:
    """Code complexity metrics for a method/function"""
    cyclomatic_complexity: int = 1  # Base complexity
    cognitive_complexity: int = 0   # Human-perceived complexity
    nesting_depth: int = 0         # Maximum nesting level
    lines_of_code: int = 0         # Physical lines
    logical_lines: int = 0         # Logical lines of code


@dataclass
class CouplingMetrics:
    """Coupling metrics for classes and modules"""
    afferent_coupling: int = 0     # Ca: Incoming dependencies
    efferent_coupling: int = 0     # Ce: Outgoing dependencies 
    instability: float = 0.0       # I = Ce / (Ca + Ce)
    abstractness: float = 0.0      # A = abstract_classes / total_classes
    distance: float = 0.0          # D = |A + I - 1|


@dataclass
class CohesionMetrics:
    """Cohesion metrics for classes"""
    lcom1: int = 0                 # Lack of Cohesion (methods pairs)
    lcom2: int = 0                 # Improved LCOM
    lcom3: float = 0.0             # Component-based LCOM
    tcc: float = 0.0               # Tight Class Cohesion


@dataclass
class QualityMetrics:
    """Combined code quality metrics"""
    complexity: ComplexityMetrics = field(default_factory=ComplexityMetrics)
    coupling: CouplingMetrics = field(default_factory=CouplingMetrics)
    cohesion: CohesionMetrics = field(default_factory=CohesionMetrics)
    maintainability_index: float = 0.0
    technical_debt_ratio: float = 0.0


class ComplexityAnalyzer(ast.NodeVisitor):
    """AST visitor to calculate cyclomatic complexity"""
    
    def __init__(self):
        self.complexity = 1  # Base complexity
        self.cognitive_complexity = 0
        self.nesting_depth = 0
        self.current_depth = 0
        self.max_depth = 0
        
    def visit_If(self, node):
        self.complexity += 1
        self.cognitive_complexity += (1 + self.current_depth)
        self._visit_with_depth(node)
        
    def visit_For(self, node):
        self.complexity += 1
        self.cognitive_complexity += (1 + self.current_depth)
        self._visit_with_depth(node)
        
    def visit_While(self, node):
        self.complexity += 1
        self.cognitive_complexity += (1 + self.current_depth)
        self._visit_with_depth(node)
        
    def visit_Try(self, node):
        self.complexity += len(node.handlers)
        self.cognitive_complexity += len(node.handlers)
        self._visit_with_depth(node)
        
    def visit_With(self, node):
        self.complexity += 1
        self._visit_with_depth(node)
        
    def visit_BoolOp(self, node):
        if isinstance(node.op, (ast.And, ast.Or)):
            self.complexity += len(node.values) - 1
        self.generic_visit(node)
        
    def visit_comprehension(self, node):
        self.complexity += 1
        for if_clause in node.ifs:
            self.complexity += 1
        self.generic_visit(node)
        
    def _visit_with_depth(self, node):
        self.current_depth += 1
        self.max_depth = max(self.max_depth, self.current_depth)
        self.generic_visit(node)
        self.current_depth -= 1


class CouplingAnalyzer:
    """Analyzes coupling between classes and modules"""
    
    def __init__(self):
        self.dependencies: Dict[str, Set[str]] = {}
        self.dependents: Dict[str, Set[str]] = {}
        
    def add_dependency(self, from_entity: str, to_entity: str):
        """Add a dependency relationship"""
        if from_entity not in self.dependencies:
            self.dependencies[from_entity] = set()
        if to_entity not in self.dependents:
            self.dependents[to_entity] = set()
            
        self.dependencies[from_entity].add(to_entity)
        self.dependents[to_entity].add(from_entity)
        
    def calculate_coupling(self, entity: str) -> CouplingMetrics:
        """Calculate coupling metrics for an entity"""
        ca = len(self.dependents.get(entity, set()))  # Afferent coupling
        ce = len(self.dependencies.get(entity, set()))  # Efferent coupling
        
        instability = ce / (ca + ce) if (ca + ce) > 0 else 0.0
        
        return CouplingMetrics(
            afferent_coupling=ca,
            efferent_coupling=ce,
            instability=instability
        )


class CohesionAnalyzer:
    """Analyzes class cohesion metrics"""
    
    def calculate_lcom1(self, class_info: ClassInfo) -> int:
        """Calculate LCOM1 (Lack of Cohesion of Methods)"""
        if not class_info.methods or not class_info.fields:
            return 0
            
        # Count method pairs that don't share any fields
        method_field_usage = {}
        
        # Analyze which fields each method uses
        for method in class_info.methods:
            used_fields = set()
            # Simple heuristic: check if field names appear in method body
            for field in class_info.fields:
                if field.name in method.body_text:
                    used_fields.add(field.name)
            method_field_usage[method.name] = used_fields
            
        # Count pairs with no shared field usage
        methods = list(method_field_usage.keys())
        no_shared_pairs = 0
        shared_pairs = 0
        
        for i in range(len(methods)):
            for j in range(i + 1, len(methods)):
                fields1 = method_field_usage[methods[i]]
                fields2 = method_field_usage[methods[j]]
                
                if fields1.intersection(fields2):
                    shared_pairs += 1
                else:
                    no_shared_pairs += 1
                    
        return max(0, no_shared_pairs - shared_pairs)
    
    def calculate_cohesion_metrics(self, class_info: ClassInfo) -> CohesionMetrics:
        """Calculate all cohesion metrics for a class"""
        lcom1 = self.calculate_lcom1(class_info)
        
        # Simple TCC calculation based on method relationships
        total_pairs = len(class_info.methods) * (len(class_info.methods) - 1) // 2
        tcc = 0.0
        if total_pairs > 0:
            connected_pairs = max(0, total_pairs - lcom1)
            tcc = connected_pairs / total_pairs
            
        return CohesionMetrics(
            lcom1=lcom1,
            tcc=tcc
        )


class CodeMetricsEngine:
    """Main engine for calculating code quality metrics"""
    
    def __init__(self):
        self.coupling_analyzer = CouplingAnalyzer()
        self.cohesion_analyzer = CohesionAnalyzer()
        
    def analyze_method_complexity(self, method: MethodInfo, source_code: str) -> ComplexityMetrics:
        """Analyze complexity metrics for a method"""
        try:
            # Parse just the method's AST node
            tree = ast.parse(source_code)
            
            # Find the method node
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == method.name:
                    analyzer = ComplexityAnalyzer()
                    analyzer.visit(node)
                    
                    # Count lines of code
                    lines = source_code.split('\n')
                    physical_lines = len([line for line in lines if line.strip()])
                    logical_lines = len([line for line in lines 
                                       if line.strip() and not line.strip().startswith('#')])
                    
                    return ComplexityMetrics(
                        cyclomatic_complexity=analyzer.complexity,
                        cognitive_complexity=analyzer.cognitive_complexity,
                        nesting_depth=analyzer.max_depth,
                        lines_of_code=physical_lines,
                        logical_lines=logical_lines
                    )
                    
        except Exception as e:
            # Return default metrics if parsing fails
            pass
            
        return ComplexityMetrics()
    
    def analyze_class_quality(self, class_info: ClassInfo, module_source: str) -> QualityMetrics:
        """Analyze quality metrics for a class"""
        # Calculate coupling metrics
        coupling = self.coupling_analyzer.calculate_coupling(class_info.id)
        
        # Calculate cohesion metrics
        cohesion = self.cohesion_analyzer.calculate_cohesion_metrics(class_info)
        
        # Calculate average complexity for class methods
        total_complexity = 0
        method_count = 0
        
        for method in class_info.methods:
            try:
                method_metrics = self.analyze_method_complexity(method, module_source)
                total_complexity += method_metrics.cyclomatic_complexity
                method_count += 1
            except:
                continue
                
        avg_complexity = total_complexity / method_count if method_count > 0 else 1
        
        # Calculate Maintainability Index (simplified version)
        # MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code)
        # Using simplified approximation
        lines_of_code = max(1, sum(len(m.body_text.split('\n')) for m in class_info.methods))
        maintainability_index = max(0, 171 - 0.23 * avg_complexity - 16.2 * math.log(lines_of_code))
        
        # Technical debt ratio (0-1, lower is better)
        technical_debt = min(1.0, (avg_complexity / 10.0) + (coupling.efferent_coupling / 20.0))
        
        return QualityMetrics(
            complexity=ComplexityMetrics(cyclomatic_complexity=int(avg_complexity)),
            coupling=coupling,
            cohesion=cohesion,
            maintainability_index=maintainability_index,
            technical_debt_ratio=technical_debt
        )
    
    def analyze_module_quality(self, module_info: ModuleInfo, source_code: str) -> QualityMetrics:
        """Analyze quality metrics for a module"""
        total_complexity = 0
        total_coupling = CouplingMetrics()
        class_count = 0
        
        # Aggregate metrics from all classes in module
        for class_info in module_info.classes:
            class_metrics = self.analyze_class_quality(class_info, source_code)
            total_complexity += class_metrics.complexity.cyclomatic_complexity
            total_coupling.efferent_coupling += class_metrics.coupling.efferent_coupling
            total_coupling.afferent_coupling += class_metrics.coupling.afferent_coupling
            class_count += 1
            
        if class_count > 0:
            avg_complexity = total_complexity / class_count
            total_coupling.instability = (total_coupling.efferent_coupling / 
                                        (total_coupling.afferent_coupling + total_coupling.efferent_coupling)
                                        if (total_coupling.afferent_coupling + total_coupling.efferent_coupling) > 0 else 0)
        else:
            avg_complexity = 1
            
        # Module-level maintainability
        lines_of_code = len(source_code.split('\n'))
        maintainability_index = max(0, 171 - 0.23 * avg_complexity - 16.2 * math.log(max(1, lines_of_code)))
        
        return QualityMetrics(
            complexity=ComplexityMetrics(cyclomatic_complexity=int(avg_complexity)),
            coupling=total_coupling,
            maintainability_index=maintainability_index
        )
    
    def get_quality_rating(self, metrics: QualityMetrics) -> str:
        """Get a quality rating based on metrics"""
        score = 0
        
        # Complexity score (lower is better)
        if metrics.complexity.cyclomatic_complexity <= 10:
            score += 30
        elif metrics.complexity.cyclomatic_complexity <= 20:
            score += 20
        elif metrics.complexity.cyclomatic_complexity <= 50:
            score += 10
            
        # Maintainability score
        if metrics.maintainability_index >= 85:
            score += 30
        elif metrics.maintainability_index >= 65:
            score += 20
        elif metrics.maintainability_index >= 40:
            score += 10
            
        # Coupling score (lower instability is better for most cases)
        if metrics.coupling.instability <= 0.3:
            score += 20
        elif metrics.coupling.instability <= 0.7:
            score += 15
        else:
            score += 10
            
        # Technical debt score (lower is better)
        if metrics.technical_debt_ratio <= 0.1:
            score += 20
        elif metrics.technical_debt_ratio <= 0.3:
            score += 10
        elif metrics.technical_debt_ratio <= 0.5:
            score += 5
            
        # Convert to letter grade
        if score >= 85:
            return "A"
        elif score >= 70:
            return "B"
        elif score >= 55:
            return "C"
        elif score >= 40:
            return "D"
        else:
            return "F"