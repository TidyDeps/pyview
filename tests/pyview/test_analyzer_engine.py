"""
Tests for PyView analyzer engine
"""

import pytest
import tempfile
import os
from unittest.mock import Mock, patch

from pyview.analyzer_engine import AnalyzerEngine, AnalysisOptions, ProgressCallback
from pyview.models import AnalysisResult


class TestAnalysisOptions:
    """Test analysis options configuration"""
    
    def test_default_options(self):
        """Test default analysis options"""
        options = AnalysisOptions()
        
        assert options.max_depth == 0  # No depth limit
        assert '__pycache__' in options.exclude_patterns
        assert '.git' in options.exclude_patterns
        assert options.include_stdlib is False
        assert 'package' in options.analysis_levels
        assert 'class' in options.analysis_levels
        assert options.enable_type_inference is True
        assert options.max_workers > 0
    
    def test_custom_options(self):
        """Test custom analysis options"""
        options = AnalysisOptions(
            max_depth=3,
            exclude_patterns=['custom_exclude'],
            include_stdlib=True,
            analysis_levels=['module', 'class'],
            max_workers=2
        )
        
        assert options.max_depth == 3
        assert options.exclude_patterns == ['custom_exclude']
        assert options.include_stdlib is True
        assert options.analysis_levels == ['module', 'class']
        assert options.max_workers == 2


class TestProgressCallback:
    """Test progress callback functionality"""
    
    def test_default_callback(self):
        """Test default progress callback"""
        callback = ProgressCallback()
        
        # Should not raise exception
        callback.update("Test stage", 50.0, extra_info="test")
    
    def test_custom_callback(self):
        """Test custom progress callback"""
        mock_callback = Mock()
        callback = ProgressCallback(mock_callback)
        
        callback.update("Test stage", 75.0, files_processed=10)
        
        mock_callback.assert_called_once()
        args = mock_callback.call_args[0][0]
        assert args['stage'] == "Test stage"
        assert args['progress'] == 75.0
        assert args['files_processed'] == 10


class TestAnalyzerEngine:
    """Test the main analyzer engine"""
    
    def setup_method(self):
        """Setup test environment"""
        self.options = AnalysisOptions(max_workers=1)  # Single-threaded for testing
        self.engine = AnalyzerEngine(self.options)
    
    def create_test_project(self) -> str:
        """Create a temporary test project"""
        temp_dir = tempfile.mkdtemp()
        
        # Create a simple Python project
        main_content = '''
"""Main module"""
import os
from .utils import helper_function

class MainClass:
    """Main class"""
    
    def __init__(self, name: str):
        self.name = name
        self.helper = helper_function()
    
    def process(self) -> str:
        if self.name:
            return f"Processing {self.name}"
        else:
            return "No name"
        '''
        
        utils_content = '''
"""Utility functions"""

def helper_function():
    """A helper function"""
    return "helper"

class UtilityClass:
    """Utility class"""
    
    @staticmethod
    def static_method():
        return 42
        '''
        
        # Write files
        main_file = os.path.join(temp_dir, "main.py")
        utils_file = os.path.join(temp_dir, "utils.py")
        init_file = os.path.join(temp_dir, "__init__.py")
        
        with open(main_file, 'w') as f:
            f.write(main_content)
        
        with open(utils_file, 'w') as f:
            f.write(utils_content)
        
        with open(init_file, 'w') as f:
            f.write('"""Test package"""')
        
        return temp_dir
    
    def test_file_discovery(self):
        """Test Python file discovery"""
        project_dir = self.create_test_project()
        
        files = self.engine._discover_project_files(project_dir)
        
        # Should find 3 Python files (main.py, utils.py, __init__.py)
        assert len(files) == 3
        
        file_names = {os.path.basename(f) for f in files}
        assert "main.py" in file_names
        assert "utils.py" in file_names
        assert "__init__.py" in file_names
    
    @patch('pyview.analyzer_engine.LegacyBridge')
    def test_pydeps_analysis_integration(self, mock_bridge_class):
        """Test integration with pydeps analysis"""
        mock_bridge = Mock()
        mock_bridge_class.return_value = mock_bridge
        
        # Mock pydeps results
        mock_bridge.analyze_with_pydeps.return_value = Mock()
        mock_bridge.convert_pydeps_to_modules.return_value = ([], [], [])
        mock_bridge.detect_cycles_from_pydeps.return_value = []
        mock_bridge.get_pydeps_metrics.return_value = {}
        
        project_dir = self.create_test_project()
        progress_callback = Mock()
        
        pydeps_result = self.engine._run_pydeps_analysis(project_dir, progress_callback)
        
        # Verify bridge was called
        mock_bridge.analyze_with_pydeps.assert_called_once()
        mock_bridge.convert_pydeps_to_modules.assert_called_once()
        
        # Check result structure
        assert 'packages' in pydeps_result
        assert 'modules' in pydeps_result
        assert 'relationships' in pydeps_result
    
    def test_ast_analysis_sequential(self):
        """Test sequential AST analysis"""
        project_dir = self.create_test_project()
        files = self.engine._discover_project_files(project_dir)
        
        progress_callback = Mock()
        
        analyses = self.engine._run_sequential_ast_analysis(files, progress_callback)
        
        # Should analyze all files
        assert len(analyses) == len(files)
        
        # All analyses should be successful (not None)
        successful_analyses = [a for a in analyses if a is not None]
        assert len(successful_analyses) == len(files)
        
        # Check progress callback was called
        assert progress_callback.update.call_count > 0
    
    def test_full_project_analysis(self):
        """Test complete project analysis end-to-end"""
        project_dir = self.create_test_project()
        
        progress_callback = ProgressCallback()
        
        # This might fail due to pydeps dependencies, so we'll mock it
        with patch.object(self.engine, '_run_pydeps_analysis') as mock_pydeps:
            mock_pydeps.return_value = {
                'dep_graph': None,
                'packages': [],
                'modules': [],
                'relationships': [],
                'cycles': [],
                'metrics': {}
            }
            
            result = self.engine.analyze_project(project_dir, progress_callback)
        
        # Check result structure
        assert isinstance(result, AnalysisResult)
        assert result.analysis_id is not None
        assert result.project_info.name is not None
        assert result.project_info.total_files > 0
        assert result.project_info.analysis_duration_seconds > 0
        
        # Should have found classes and methods from AST analysis
        assert len(result.dependency_graph.classes) >= 2  # MainClass, UtilityClass
        assert len(result.dependency_graph.methods) >= 4  # __init__, process, helper_function, static_method
    
    def test_error_handling_in_analysis(self):
        """Test error handling during analysis"""
        # Create a project with syntax error
        temp_dir = tempfile.mkdtemp()
        
        broken_content = '''
def broken_function(
    # Missing closing parenthesis
    return "broken"
        '''
        
        broken_file = os.path.join(temp_dir, "broken.py")
        with open(broken_file, 'w') as f:
            f.write(broken_content)
        
        # Should handle the error gracefully
        files = [broken_file]
        progress_callback = Mock()
        
        analyses = self.engine._run_sequential_ast_analysis(files, progress_callback)
        
        # Should return an analysis with parse error
        assert len(analyses) == 1
        analysis = analyses[0]
        assert analysis is not None
        assert analysis.parse_error is not None
    
    def test_cycle_detection(self):
        """Test cycle detection in relationships"""
        # Create mock data with cycles
        classes = []
        methods = []
        relationships = []
        
        # This is a simplified test - in practice, cycle detection would be more complex
        cycles = self.engine._detect_detailed_cycles(classes, methods, relationships)
        
        # Should return a list (empty in this case)
        assert isinstance(cycles, list)
    
    def test_metrics_calculation(self):
        """Test enhanced metrics calculation"""
        # Create mock data
        packages = []
        modules = []
        classes = []
        methods = []
        relationships = []
        
        metrics = self.engine._calculate_enhanced_metrics(
            packages, modules, classes, methods, relationships
        )
        
        # Should return metrics structure
        assert 'entity_counts' in metrics
        assert 'complexity_metrics' in metrics
        assert 'coupling_metrics' in metrics
        assert 'quality_metrics' in metrics
        
        # Check entity counts
        counts = metrics['entity_counts']
        assert counts['packages'] == 0
        assert counts['modules'] == 0
        assert counts['classes'] == 0