"""
PyView Code Quality Metrics

Implements code quality metrics including:
- Cyclomatic Complexity
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
    lines_of_code: int = 0         # Physical lines
    logical_lines: int = 0         # Logical lines of code


@dataclass
class QualityMetrics:
    """Combined code quality metrics"""
    complexity: ComplexityMetrics = field(default_factory=ComplexityMetrics)
    maintainability_index: float = 0.0


class ComplexityAnalyzer(ast.NodeVisitor):
    """AST visitor to calculate cyclomatic complexity"""
    
    def __init__(self):
        self.complexity = 1  # Base complexity
        
    def visit_If(self, node):
        self.complexity += 1
        self.generic_visit(node)
        
    def visit_For(self, node):
        self.complexity += 1
        self.generic_visit(node)
        
    def visit_While(self, node):
        self.complexity += 1
        self.generic_visit(node)
        
    def visit_Try(self, node):
        self.complexity += len(node.handlers)
        self.generic_visit(node)
        
    def visit_With(self, node):
        self.complexity += 1
        self.generic_visit(node)
        
    def visit_BoolOp(self, node):
        if isinstance(node.op, (ast.And, ast.Or)):
            self.complexity += len(node.values) - 1
        self.generic_visit(node)
        
    def visit_comprehension(self, node):
        self.complexity += 1
        for if_clause in node.ifs:
            self.complexity += 1
        self.generic_visit(node)
        


class CodeMetricsEngine:
    """Main engine for calculating code quality metrics"""
    
    def __init__(self):
        pass
        
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
                        lines_of_code=physical_lines,
                        logical_lines=logical_lines
                    )
                    
        except Exception as e:
            # Return default metrics if parsing fails
            pass
            
        return ComplexityMetrics()
    
    def analyze_class_quality(self, class_info: ClassInfo, module_source: str) -> QualityMetrics:
        """Analyze quality metrics for a class"""
        # Calculate average complexity for class methods
        total_complexity = 0
        total_loc = 0
        method_count = 0
        
        for method in class_info.methods:
            try:
                method_metrics = self.analyze_method_complexity(method, module_source)
                total_complexity += method_metrics.cyclomatic_complexity
                total_loc += method_metrics.lines_of_code
                method_count += 1
            except:
                continue
                
        avg_complexity = total_complexity / method_count if method_count > 0 else 1
        
        # Calculate Maintainability Index (simplified version)
        # MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code)
        # Using simplified approximation
        lines_of_code = max(1, sum(len(m.body_text.split('\n')) for m in class_info.methods))
        maintainability_index = max(0, 171 - 0.23 * avg_complexity - 16.2 * math.log(lines_of_code))
        
        return QualityMetrics(
            complexity=ComplexityMetrics(
                cyclomatic_complexity=int(avg_complexity),
                lines_of_code=total_loc
            ),
            maintainability_index=maintainability_index
        )
    
    def analyze_module_quality(self, module_info: ModuleInfo, source_code: str) -> QualityMetrics:
        """Analyze quality metrics for a module"""
        total_complexity = 0
        total_loc = 0
        class_count = 0
        
        # Aggregate metrics from all classes in module
        for class_info in module_info.classes:
            class_metrics = self.analyze_class_quality(class_info, source_code)
            total_complexity += class_metrics.complexity.cyclomatic_complexity
            total_loc += class_metrics.complexity.lines_of_code
            class_count += 1
            
        if class_count > 0:
            avg_complexity = total_complexity / class_count
        else:
            avg_complexity = 1
            
        # Module-level maintainability
        lines_of_code = len(source_code.split('\n'))
        maintainability_index = max(0, 171 - 0.23 * avg_complexity - 16.2 * math.log(max(1, lines_of_code)))
        
        return QualityMetrics(
            complexity=ComplexityMetrics(
                cyclomatic_complexity=int(avg_complexity),
                lines_of_code=total_loc if class_count > 0 else lines_of_code
            ),
            maintainability_index=maintainability_index
        )
    
    def get_quality_rating(self, metrics: QualityMetrics) -> str:
        """Get a quality rating based on metrics"""
        score = 0
        
        # Complexity score (lower is better) - 50 points
        if metrics.complexity.cyclomatic_complexity <= 10:
            score += 50
        elif metrics.complexity.cyclomatic_complexity <= 20:
            score += 30
        elif metrics.complexity.cyclomatic_complexity <= 50:
            score += 15
            
        # Maintainability score - 50 points
        if metrics.maintainability_index >= 85:
            score += 50
        elif metrics.maintainability_index >= 65:
            score += 30
        elif metrics.maintainability_index >= 40:
            score += 15
            
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