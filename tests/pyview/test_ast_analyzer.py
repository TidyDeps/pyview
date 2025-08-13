"""
Tests for PyView AST analyzer
"""

import pytest
import tempfile
import os
from pathlib import Path

from pyview.ast_analyzer import ASTAnalyzer, FileAnalysis
from pyview.models import ClassInfo, MethodInfo, FieldInfo, ImportInfo


class TestASTAnalyzer:
    """Test AST analysis functionality"""
    
    def setup_method(self):
        """Setup test environment"""
        self.analyzer = ASTAnalyzer()
        
    def create_temp_file(self, content: str, filename: str = "test.py") -> str:
        """Create temporary Python file with content"""
        temp_dir = tempfile.mkdtemp()
        file_path = os.path.join(temp_dir, filename)
        
        with open(file_path, 'w') as f:
            f.write(content)
        
        return file_path
    
    def test_simple_class_analysis(self):
        """Test analysis of a simple class"""
        content = '''
class MyClass:
    """A simple test class"""
    
    def __init__(self):
        self.attribute = "value"
    
    def method(self):
        return self.attribute
        '''
        
        file_path = self.create_temp_file(content)
        analysis = self.analyzer.analyze_file(file_path)
        
        assert analysis is not None
        assert len(analysis.classes) == 1
        
        cls = analysis.classes[0]
        assert cls.name == "MyClass"
        assert cls.docstring == "A simple test class"
        assert len(cls.methods) == 2  # __init__ and method
        
        # Check methods
        method_names = {m.name for m in analysis.methods}
        assert "__init__" in method_names
        assert "method" in method_names
        
        # Check fields
        assert len(analysis.fields) >= 1  # self.attribute
        field_names = {f.name for f in analysis.fields}
        assert "attribute" in field_names
    
    def test_inheritance_analysis(self):
        """Test analysis of class inheritance"""
        content = '''
class Parent:
    pass

class Child(Parent):
    def method(self):
        pass
        '''
        
        file_path = self.create_temp_file(content)
        analysis = self.analyzer.analyze_file(file_path)
        
        assert len(analysis.classes) == 2
        
        # Find child class
        child_class = next(cls for cls in analysis.classes if cls.name == "Child")
        assert "Parent" in child_class.bases
    
    def test_import_analysis(self):
        """Test analysis of import statements"""
        content = '''
import os
import sys as system
from typing import List, Dict
from .local_module import LocalClass
        '''
        
        file_path = self.create_temp_file(content)
        analysis = self.analyzer.analyze_file(file_path)
        
        assert len(analysis.imports) >= 4
        
        # Check different import types
        import_modules = {imp.module for imp in analysis.imports}
        assert "os" in import_modules
        assert "sys" in import_modules
        assert "typing" in import_modules
        
        # Check aliases
        sys_import = next(imp for imp in analysis.imports if imp.module == "sys")
        assert sys_import.alias == "system"
        
        # Check from imports
        typing_imports = [imp for imp in analysis.imports if imp.module == "typing"]
        imported_names = {imp.name for imp in typing_imports}
        assert "List" in imported_names
        assert "Dict" in imported_names
    
    def test_method_complexity_calculation(self):
        """Test cyclomatic complexity calculation"""
        content = '''
def simple_function():
    return True

def complex_function(x):
    if x > 0:
        for i in range(x):
            if i % 2 == 0:
                try:
                    result = 1 / i
                except ZeroDivisionError:
                    continue
                else:
                    return result
    elif x < 0:
        while x < 0:
            x += 1
    else:
        return 0
        '''
        
        file_path = self.create_temp_file(content)
        analysis = self.analyzer.analyze_file(file_path)
        
        assert len(analysis.methods) == 2
        
        # Simple function should have complexity 1
        simple_func = next(m for m in analysis.methods if m.name == "simple_function")
        assert simple_func.complexity == 1
        
        # Complex function should have higher complexity
        complex_func = next(m for m in analysis.methods if m.name == "complex_function")
        assert complex_func.complexity > 5  # Should be around 8-10
    
    def test_decorator_analysis(self):
        """Test analysis of decorators"""
        content = '''
@property
def getter(self):
    return self._value

@staticmethod
def static_method():
    return "static"

@classmethod
def class_method(cls):
    return cls

class DecoratedClass:
    @property
    def prop(self):
        return 42
        '''
        
        file_path = self.create_temp_file(content)
        analysis = self.analyzer.analyze_file(file_path)
        
        # Check method decorators
        getter = next(m for m in analysis.methods if m.name == "getter")
        assert "property" in getter.decorators
        assert getter.is_property
        
        static = next(m for m in analysis.methods if m.name == "static_method")
        assert "staticmethod" in static.decorators
        assert static.is_static
        
        class_method = next(m for m in analysis.methods if m.name == "class_method") 
        assert "classmethod" in class_method.decorators
        assert class_method.is_class_method
    
    def test_type_annotation_analysis(self):
        """Test analysis of type annotations"""
        content = '''
from typing import List, Optional

class TypedClass:
    count: int = 0
    
    def __init__(self, name: str):
        self.name: str = name
        self.items: List[str] = []
    
    def get_name(self) -> Optional[str]:
        return self.name if self.name else None
        '''
        
        file_path = self.create_temp_file(content)
        analysis = self.analyzer.analyze_file(file_path)
        
        # Check class field with type annotation
        count_field = next(f for f in analysis.fields if f.name == "count")
        assert count_field.type_annotation == "int"
        assert count_field.default_value == "0"
        assert count_field.is_class_variable
        
        # Check instance field with type annotation
        name_field = next(f for f in analysis.fields if f.name == "name")
        assert name_field.type_annotation == "str"
        
        # Check method return annotation
        get_name_method = next(m for m in analysis.methods if m.name == "get_name")
        assert get_name_method.return_annotation == "Optional[str]"
    
    def test_syntax_error_handling(self):
        """Test handling of files with syntax errors"""
        content = '''
def broken_function(
    # Missing closing parenthesis
    return "broken"
        '''
        
        file_path = self.create_temp_file(content)
        analysis = self.analyzer.analyze_file(file_path)
        
        assert analysis is not None
        assert analysis.parse_error is not None
        assert "SyntaxError" in analysis.parse_error or "syntax" in analysis.parse_error.lower()
    
    def test_project_analysis(self):
        """Test analysis of multiple files in a project"""
        # Create a temporary project structure
        temp_dir = tempfile.mkdtemp()
        
        # Create main module
        main_content = '''
from .submodule import SubClass

class MainClass:
    def __init__(self):
        self.sub = SubClass()
        '''
        
        # Create sub module  
        sub_content = '''
class SubClass:
    def method(self):
        return "sub"
        '''
        
        main_file = os.path.join(temp_dir, "main.py")
        sub_file = os.path.join(temp_dir, "submodule.py")
        
        with open(main_file, 'w') as f:
            f.write(main_content)
        
        with open(sub_file, 'w') as f:
            f.write(sub_content)
        
        # Analyze project
        analyses = self.analyzer.analyze_project(temp_dir)
        
        assert len(analyses) == 2
        
        # Check that both files were analyzed
        file_names = {os.path.basename(a.file_path) for a in analyses}
        assert "main.py" in file_names
        assert "submodule.py" in file_names
        
        # Check cross-file references
        main_analysis = next(a for a in analyses if "main.py" in a.file_path)
        assert len(main_analysis.imports) > 0
        
        submodule_import = next(
            imp for imp in main_analysis.imports 
            if "submodule" in imp.module or "SubClass" in (imp.name or "")
        )
        assert submodule_import is not None