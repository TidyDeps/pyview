"""
Tests for PyView data models
"""

import pytest
import json
from pyview.models import (
    PackageInfo, ModuleInfo, ClassInfo, MethodInfo, FieldInfo,
    Relationship, DependencyType, AnalysisResult, ProjectInfo,
    DependencyGraph, create_module_id, create_class_id
)


class TestDataModels:
    """Test PyView data models"""
    
    def test_package_info_creation(self):
        """Test PackageInfo creation"""
        package = PackageInfo(
            id="pkg:mypackage",
            name="mypackage",
            path="/path/to/mypackage"
        )
        
        assert package.id == "pkg:mypackage"
        assert package.name == "mypackage"
        assert package.path == "/path/to/mypackage"
        assert package.modules == []
        assert package.sub_packages == []
    
    def test_module_info_creation(self):
        """Test ModuleInfo creation"""
        module = ModuleInfo(
            id="mod:mymodule",
            name="mymodule",
            file_path="/path/to/mymodule.py"
        )
        
        assert module.id == "mod:mymodule"
        assert module.name == "mymodule"
        assert module.file_path == "/path/to/mymodule.py"
        assert module.classes == []
        assert module.functions == []
    
    def test_class_info_creation(self):
        """Test ClassInfo creation"""
        class_info = ClassInfo(
            id="cls:mod:mymodule:MyClass",
            name="MyClass",
            module_id="mod:mymodule",
            line_number=10,
            file_path="/path/to/mymodule.py"
        )
        
        assert class_info.id == "cls:mod:mymodule:MyClass"
        assert class_info.name == "MyClass"
        assert class_info.module_id == "mod:mymodule"
        assert class_info.line_number == 10
        assert class_info.methods == []
        assert class_info.fields == []
    
    def test_method_info_creation(self):
        """Test MethodInfo creation"""
        method = MethodInfo(
            id="meth:cls:mod:mymodule:MyClass:my_method:20",
            name="my_method",
            line_number=20,
            file_path="/path/to/mymodule.py",
            class_id="cls:mod:mymodule:MyClass",
            is_method=True
        )
        
        assert method.id == "meth:cls:mod:mymodule:MyClass:my_method:20"
        assert method.name == "my_method"
        assert method.line_number == 20
        assert method.is_method is True
        assert method.complexity == 1  # default
    
    def test_relationship_creation(self):
        """Test Relationship creation"""
        rel = Relationship(
            id="rel:from->to:import",
            from_entity="mod:module1",
            to_entity="mod:module2",
            relationship_type=DependencyType.IMPORT,
            line_number=5,
            file_path="/path/to/module1.py"
        )
        
        assert rel.from_entity == "mod:module1"
        assert rel.to_entity == "mod:module2"
        assert rel.relationship_type == DependencyType.IMPORT
        assert rel.strength == 1.0  # default
    
    def test_dependency_graph_operations(self):
        """Test DependencyGraph operations"""
        graph = DependencyGraph()
        
        # Add a package
        package = PackageInfo(id="pkg:test", name="test", path="/test")
        graph.add_package(package)
        
        # Add a module
        module = ModuleInfo(id="mod:test.module", name="test.module", file_path="/test/module.py")
        graph.add_module(module)
        
        # Add a class
        class_info = ClassInfo(
            id="cls:mod:test.module:TestClass",
            name="TestClass",
            module_id="mod:test.module",
            line_number=10,
            file_path="/test/module.py"
        )
        graph.add_class(class_info)
        
        # Test lookups
        assert len(graph.packages) == 1
        assert len(graph.modules) == 1
        assert len(graph.classes) == 1
        
        # Test entity retrieval
        retrieved_package = graph.get_entity("pkg:test")
        assert retrieved_package == package
        
        retrieved_module = graph.get_entity("mod:test.module")
        assert retrieved_module == module
        
        retrieved_class = graph.get_entity("cls:mod:test.module:TestClass")
        assert retrieved_class == class_info
    
    def test_analysis_result_json_serialization(self):
        """Test AnalysisResult JSON serialization"""
        # Create minimal analysis result
        project_info = ProjectInfo(
            name="test_project",
            path="/path/to/test",
            analyzed_at="2024-01-01T00:00:00",
            total_files=5,
            analysis_duration_seconds=10.5
        )
        
        dependency_graph = DependencyGraph()
        dependency_graph.add_package(PackageInfo(id="pkg:test", name="test", path="/test"))
        
        result = AnalysisResult(
            analysis_id="test-123",
            project_info=project_info,
            dependency_graph=dependency_graph
        )
        
        # Test conversion to dict
        result_dict = result.to_dict()
        assert result_dict['analysis_id'] == "test-123"
        assert result_dict['project_info']['name'] == "test_project"
        
        # Test JSON serialization
        json_str = result.to_json()
        assert "test-123" in json_str
        assert "test_project" in json_str
        
        # Verify JSON is valid
        parsed = json.loads(json_str)
        assert parsed['analysis_id'] == "test-123"
    
    def test_id_generation_functions(self):
        """Test ID generation utility functions"""
        module_id = create_module_id("mypackage.mymodule")
        assert module_id == "mod:mypackage.mymodule"
        
        class_id = create_class_id("mod:mymodule", "MyClass")
        assert class_id == "cls:mod:mymodule:MyClass"
    
    def test_entity_count(self):
        """Test entity counting in AnalysisResult"""
        project_info = ProjectInfo(
            name="test",
            path="/test",
            analyzed_at="2024-01-01T00:00:00",
            total_files=1,
            analysis_duration_seconds=1.0
        )
        
        graph = DependencyGraph()
        graph.add_package(PackageInfo(id="pkg:1", name="pkg1", path="/pkg1"))
        graph.add_module(ModuleInfo(id="mod:1", name="mod1", file_path="/mod1.py"))
        graph.add_class(ClassInfo(
            id="cls:1", name="cls1", module_id="mod:1", 
            line_number=1, file_path="/mod1.py"
        ))
        
        result = AnalysisResult(
            analysis_id="test",
            project_info=project_info,
            dependency_graph=graph,
            relationships=[
                Relationship(
                    id="rel:1", from_entity="mod:1", to_entity="mod:2",
                    relationship_type=DependencyType.IMPORT,
                    line_number=1, file_path="/mod1.py"
                )
            ]
        )
        
        counts = result.get_entity_count()
        assert counts['packages'] == 1
        assert counts['modules'] == 1  
        assert counts['classes'] == 1
        assert counts['relationships'] == 1