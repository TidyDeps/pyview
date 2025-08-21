"""
PyView AST 분석 엔진

AST를 사용해서 Python 소스 코드를 상세하게 분석함.
클래스, 메소드, 필드 정의와 관계들을 추출함.
"""

import ast
import os
import sys
import logging
from pathlib import Path
from typing import List, Dict, Set, Optional, Tuple, Union
from dataclasses import dataclass

from .models import (
    ModuleInfo, ClassInfo, MethodInfo, FieldInfo, ImportInfo,
    DependencyType, Relationship, 
    create_module_id, create_class_id, create_method_id, create_field_id,
    create_relationship_id
)

logger = logging.getLogger(__name__)


@dataclass
class FileAnalysis:
    """Python 파일 하나에 대한 분석 결과"""
    file_path: str
    module_info: ModuleInfo
    classes: List[ClassInfo]
    methods: List[MethodInfo]  # Both class methods and module functions
    fields: List[FieldInfo]
    imports: List[ImportInfo]
    relationships: List[Relationship]
    parse_error: Optional[str] = None


class SymbolTableBuilder(ast.NodeVisitor):
    """Builds symbol table by collecting class, method, field definitions"""
    
    def __init__(self, file_path: str, module_name: str):
        self.file_path = file_path
        self.module_name = module_name
        self.module_id = create_module_id(module_name)
        
        # Collections
        self.classes: List[ClassInfo] = []
        self.methods: List[MethodInfo] = []
        self.fields: List[FieldInfo] = []
        self.imports: List[ImportInfo] = []
        
        # Current context tracking
        self.current_class: Optional[ClassInfo] = None
        self.scope_stack: List[Union[ClassInfo, MethodInfo]] = []
        
        # Symbol tables for each scope
        self.symbol_tables: Dict[str, Set[str]] = {}
        
    def visit_Import(self, node: ast.Import) -> None:
        """Visit import statement"""
        for alias in node.names:
            import_info = ImportInfo(
                module=alias.name,
                alias=alias.asname,
                line_number=node.lineno,
                import_type="import"
            )
            self.imports.append(import_info)
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """Visit from...import statement"""
        if node.module:  # Skip relative imports like "from . import"
            for alias in node.names:
                import_info = ImportInfo(
                    module=node.module,
                    name=alias.name,
                    alias=alias.asname,
                    line_number=node.lineno,
                    import_type="from_import",
                    is_relative=node.level > 0
                )
                self.imports.append(import_info)
        self.generic_visit(node)
    
    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """Visit class definition"""
        class_id = create_class_id(self.module_id, node.name)
        
        # Extract base classes
        bases = []
        for base in node.bases:
            base_name = self._extract_name(base)
            if base_name:
                bases.append(base_name)
        
        # Extract decorators
        decorators = []
        for decorator in node.decorator_list:
            decorator_name = self._extract_name(decorator)
            if decorator_name:
                decorators.append(decorator_name)
        
        # Extract docstring
        docstring = ast.get_docstring(node)
        
        # Check if abstract class
        is_abstract = any('abc' in decorator.lower() or 'abstract' in decorator.lower() 
                         for decorator in decorators)
        
        class_info = ClassInfo(
            id=class_id,
            name=node.name,
            module_id=self.module_id,
            line_number=node.lineno,
            file_path=self.file_path,
            bases=bases,
            decorators=decorators,
            is_abstract=is_abstract,
            docstring=docstring
        )
        
        self.classes.append(class_info)
        
        # Set current class context
        old_class = self.current_class
        self.current_class = class_info
        self.scope_stack.append(class_info)
        
        # Visit class body
        self.generic_visit(node)
        
        # Restore previous context
        self.current_class = old_class
        self.scope_stack.pop()
    
    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Visit function/method definition"""
        self._visit_function_def(node)
    
    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """Visit async function/method definition"""
        self._visit_function_def(node)
    
    def _visit_function_def(self, node: Union[ast.FunctionDef, ast.AsyncFunctionDef]) -> None:
        """Common logic for function/method definitions"""
        is_method = self.current_class is not None
        
        # Create method ID
        if is_method:
            method_id = create_method_id(self.current_class.id, node.name, node.lineno)
            class_id = self.current_class.id
        else:
            method_id = create_method_id(None, node.name, node.lineno)
            class_id = None
        
        # Extract arguments
        args = []
        for arg in node.args.args:
            args.append(arg.arg)
        
        # Extract return annotation
        return_annotation = None
        if node.returns:
            return_annotation = self._extract_annotation(node.returns)
        
        # Extract decorators
        decorators = []
        for decorator in node.decorator_list:
            decorator_name = self._extract_name(decorator)
            if decorator_name:
                decorators.append(decorator_name)
        
        # Analyze method type
        is_static = any(d in ['staticmethod', 'staticmethod()'] for d in decorators)
        is_class_method = any(d in ['classmethod', 'classmethod()'] for d in decorators)
        is_property = any(d in ['property', 'property()'] for d in decorators)
        
        # Extract docstring
        docstring = ast.get_docstring(node)
        
        # Calculate cyclomatic complexity
        complexity = self._calculate_complexity(node)
        
        method_info = MethodInfo(
            id=method_id,
            name=node.name,
            line_number=node.lineno,
            file_path=self.file_path,
            class_id=class_id,
            args=args,
            return_annotation=return_annotation,
            decorators=decorators,
            is_method=is_method,
            is_static=is_static,
            is_class_method=is_class_method,
            is_property=is_property,
            complexity=complexity,
            docstring=docstring
        )
        
        self.methods.append(method_info)
        
        # Add to current class
        if is_method and self.current_class:
            self.current_class.methods.append(method_id)
        
        # Enter method scope
        self.scope_stack.append(method_info)
        
        # Visit method body (to find calls)
        self.generic_visit(node)
        
        # Exit method scope
        self.scope_stack.pop()
    
    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        """Visit annotated assignment (type hints)"""
        if self.current_class and isinstance(node.target, ast.Name):
            self._create_field(node.target.id, node.lineno, node.annotation, node.value)
        self.generic_visit(node)
    
    def visit_Assign(self, node: ast.Assign) -> None:
        """Visit regular assignment"""
        if self.current_class:
            for target in node.targets:
                if isinstance(target, ast.Name):
                    # Instance/class variable
                    self._create_field(target.id, node.lineno, None, node.value)
                elif isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name):
                    if target.value.id == 'self':
                        # self.attribute = value
                        self._create_field(target.attr, node.lineno, None, node.value)
        self.generic_visit(node)
    
    def _create_field(self, name: str, line_number: int, 
                     annotation: Optional[ast.AST] = None,
                     value: Optional[ast.AST] = None) -> None:
        """Create a field info object"""
        if not self.current_class:
            return
        
        field_id = create_field_id(self.current_class.id, name)
        
        # Extract type annotation
        type_annotation = None
        if annotation:
            type_annotation = self._extract_annotation(annotation)
        
        # Extract default value
        default_value = None
        if value:
            default_value = self._extract_value(value)
        
        # Check if it's a class variable (defined outside __init__)
        is_class_variable = not any(
            isinstance(scope, MethodInfo) and scope.name == '__init__' 
            for scope in self.scope_stack
        )
        
        field_info = FieldInfo(
            id=field_id,
            name=name,
            class_id=self.current_class.id,
            line_number=line_number,
            file_path=self.file_path,
            type_annotation=type_annotation,
            default_value=default_value,
            is_class_variable=is_class_variable
        )
        
        self.fields.append(field_info)
        
        # Add to current class
        self.current_class.fields.append(field_id)
    
    def _extract_name(self, node: ast.AST) -> Optional[str]:
        """Extract name from various AST nodes"""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            base = self._extract_name(node.value)
            return f"{base}.{node.attr}" if base else node.attr
        elif isinstance(node, ast.Constant):
            return str(node.value)
        return None
    
    def _extract_annotation(self, node: ast.AST) -> str:
        """Extract type annotation as string"""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            base = self._extract_annotation(node.value)
            return f"{base}.{node.attr}"
        elif isinstance(node, ast.Constant):
            return repr(node.value)
        elif isinstance(node, ast.Subscript):
            value = self._extract_annotation(node.value)
            slice_val = self._extract_annotation(node.slice)
            return f"{value}[{slice_val}]"
        else:
            return ast.unparse(node) if hasattr(ast, 'unparse') else str(node)
    
    def _extract_value(self, node: ast.AST) -> Optional[str]:
        """Extract default value as string"""
        try:
            if isinstance(node, ast.Constant):
                return repr(node.value)
            elif isinstance(node, ast.Name):
                return node.id
            elif hasattr(ast, 'unparse'):
                return ast.unparse(node)
            else:
                return str(node)
        except:
            return None
    
    def _calculate_complexity(self, node: ast.FunctionDef) -> int:
        """Calculate cyclomatic complexity of a function"""
        complexity = 1  # Base complexity
        
        for child in ast.walk(node):
            # Decision points that increase complexity
            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):
                complexity += 1
            elif isinstance(child, ast.ExceptHandler):
                complexity += 1
            elif isinstance(child, (ast.And, ast.Or)):
                complexity += 1
            elif isinstance(child, ast.comprehension):
                complexity += 1
        
        return complexity


class ReferenceExtractor(ast.NodeVisitor):
    """Extracts references and relationships between entities"""
    
    def __init__(self, symbol_table: SymbolTableBuilder):
        self.symbol_table = symbol_table
        self.relationships: List[Relationship] = []
        self.current_method: Optional[MethodInfo] = None
        self.scope_stack: List[Union[ClassInfo, MethodInfo]] = []
    
    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """Visit class definition to extract inheritance relationships"""
        class_id = create_class_id(self.symbol_table.module_id, node.name)
        
        # Extract inheritance relationships
        for base in node.bases:
            base_name = self._extract_name(base)
            if base_name:
                relationship = Relationship(
                    id=create_relationship_id(class_id, base_name, DependencyType.INHERITANCE),
                    from_entity=class_id,
                    to_entity=base_name,  # Will be resolved later
                    relationship_type=DependencyType.INHERITANCE,
                    line_number=node.lineno,
                    file_path=self.symbol_table.file_path,
                    strength=1.0
                )
                self.relationships.append(relationship)
        
        # Find corresponding class info and enter scope
        class_info = next((c for c in self.symbol_table.classes if c.id == class_id), None)
        if class_info:
            self.scope_stack.append(class_info)
        
        self.generic_visit(node)
        
        if class_info:
            self.scope_stack.pop()
    
    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Visit function definition"""
        self._visit_function_def(node)
    
    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """Visit async function definition"""
        self._visit_function_def(node)
    
    def _visit_function_def(self, node: Union[ast.FunctionDef, ast.AsyncFunctionDef]) -> None:
        """Common logic for function definitions"""
        current_class = None
        for scope in reversed(self.scope_stack):
            if isinstance(scope, ClassInfo):
                current_class = scope
                break
        
        if current_class:
            method_id = create_method_id(current_class.id, node.name, node.lineno)
        else:
            method_id = create_method_id(None, node.name, node.lineno)
        
        # Find corresponding method info
        method_info = next((m for m in self.symbol_table.methods if m.id == method_id), None)
        if method_info:
            self.current_method = method_info
            self.scope_stack.append(method_info)
        
        self.generic_visit(node)
        
        if method_info:
            self.current_method = None
            self.scope_stack.pop()
    
    def visit_Call(self, node: ast.Call) -> None:
        """Visit function/method call"""
        if self.current_method:
            # Extract called function/method name
            call_target = self._extract_call_target(node.func)
            if call_target:
                relationship = Relationship(
                    id=create_relationship_id(self.current_method.id, call_target, DependencyType.CALL),
                    from_entity=self.current_method.id,
                    to_entity=call_target,  # Will be resolved later
                    relationship_type=DependencyType.CALL,
                    line_number=node.lineno,
                    file_path=self.symbol_table.file_path,
                    strength=1.0
                )
                self.relationships.append(relationship)
        
        self.generic_visit(node)
    
    def visit_Attribute(self, node: ast.Attribute) -> None:
        """Visit attribute access"""
        if self.current_method and isinstance(node.ctx, ast.Load):
            # Extract attribute access
            attr_target = self._extract_attribute_target(node)
            if attr_target:
                relationship = Relationship(
                    id=create_relationship_id(self.current_method.id, attr_target, DependencyType.ATTRIBUTE_ACCESS),
                    from_entity=self.current_method.id,
                    to_entity=attr_target,  # Will be resolved later
                    relationship_type=DependencyType.ATTRIBUTE_ACCESS,
                    line_number=node.lineno,
                    file_path=self.symbol_table.file_path,
                    strength=0.5  # Attribute access is weaker than method calls
                )
                self.relationships.append(relationship)
        
        self.generic_visit(node)
    
    def _extract_name(self, node: ast.AST) -> Optional[str]:
        """Extract name from AST node"""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            base = self._extract_name(node.value)
            return f"{base}.{node.attr}" if base else node.attr
        return None
    
    def _extract_call_target(self, node: ast.AST) -> Optional[str]:
        """Extract the target of a function call"""
        return self._extract_name(node)
    
    def _extract_attribute_target(self, node: ast.Attribute) -> Optional[str]:
        """Extract the target of an attribute access"""
        if isinstance(node.value, ast.Name):
            return f"{node.value.id}.{node.attr}"
        return None


class ASTAnalyzer:
    """Main AST analyzer class"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def analyze_file(self, file_path: str) -> Optional[FileAnalysis]:
        """Analyze a single Python file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                source = f.read()
            
            # Parse the source code
            tree = ast.parse(source, filename=file_path)
            
            # Get module name from file path
            module_name = self._get_module_name(file_path)
            
            # Build symbol table
            symbol_builder = SymbolTableBuilder(file_path, module_name)
            symbol_builder.visit(tree)
            
            # Extract references
            ref_extractor = ReferenceExtractor(symbol_builder)
            ref_extractor.visit(tree)
            
            # Create module info
            module_id = create_module_id(module_name)
            module_info = ModuleInfo(
                id=module_id,
                name=module_name,
                file_path=file_path,
                classes=[cls.id for cls in symbol_builder.classes],
                functions=[meth.id for meth in symbol_builder.methods if not meth.is_method],
                imports=symbol_builder.imports,
                loc=len(source.splitlines()),
                docstring=ast.get_docstring(tree)
            )
            
            return FileAnalysis(
                file_path=file_path,
                module_info=module_info,
                classes=symbol_builder.classes,
                methods=symbol_builder.methods,
                fields=symbol_builder.fields,
                imports=symbol_builder.imports,
                relationships=ref_extractor.relationships
            )
            
        except SyntaxError as e:
            self.logger.warning(f"Syntax error in {file_path}: {e}")
            return FileAnalysis(
                file_path=file_path,
                module_info=ModuleInfo(
                    id=create_module_id(self._get_module_name(file_path)),
                    name=self._get_module_name(file_path),
                    file_path=file_path
                ),
                classes=[],
                methods=[],
                fields=[],
                imports=[],
                relationships=[],
                parse_error=str(e)
            )
        except Exception as e:
            self.logger.error(f"Error analyzing {file_path}: {e}")
            return None
    
    def analyze_project(self, project_path: str, 
                       exclude_patterns: List[str] = None) -> List[FileAnalysis]:
        """Analyze all Python files in a project"""
        if exclude_patterns is None:
            exclude_patterns = ['__pycache__', '.git', '.venv', 'venv', 'env']
        
        python_files = self._find_python_files(project_path, exclude_patterns)
        
        analyses = []
        for file_path in python_files:
            analysis = self.analyze_file(file_path)
            if analysis:
                analyses.append(analysis)
        
        return analyses
    
    def _get_module_name(self, file_path: str) -> str:
        """Convert file path to module name"""
        path = Path(file_path)
        
        # Remove .py extension
        if path.suffix == '.py':
            module_name = path.stem
        else:
            module_name = path.name
        
        # Get parent directories for package structure
        parts = path.parts[:-1]  # Exclude filename
        
        # Find the root (where setup.py, pyproject.toml, or __init__.py exists)
        for i, part in enumerate(reversed(parts)):
            parent_path = Path(*parts[:len(parts)-i])
            if (parent_path / 'setup.py').exists() or \
               (parent_path / 'pyproject.toml').exists() or \
               (parent_path / '__init__.py').exists():
                break
        
        # Build module name from remaining path components
        remaining_parts = parts[len(parts)-i:] if i < len(parts) else parts
        if remaining_parts:
            return '.'.join(remaining_parts + (module_name,))
        else:
            return module_name
    
    def _find_python_files(self, project_path: str, 
                          exclude_patterns: List[str]) -> List[str]:
        """Find all Python files in the project"""
        python_files = []
        
        for root, dirs, files in os.walk(project_path):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if not any(pattern in d for pattern in exclude_patterns)]
            
            for file in files:
                if file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    # Skip if any exclude pattern is in the path
                    if not any(pattern in file_path for pattern in exclude_patterns):
                        python_files.append(file_path)
        
        return python_files