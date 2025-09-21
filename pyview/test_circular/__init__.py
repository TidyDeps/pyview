"""
Test circular dependency package

This package contains modules with intentional circular dependencies
to test pyview's cycle detection capabilities:

- module_a imports module_b and module_c
- module_b imports module_c and module_a (in function)  
- module_c imports module_a

This creates multiple cycles:
1. A -> B -> C -> A (3-way cycle)
2. A -> C -> A (2-way cycle through classes)
3. B -> C -> A -> B (through function calls)
"""

# Import all modules to make them available
from . import module_a
from . import module_b  
from . import module_c

# Create some additional cross-dependencies at package level
from .module_a import DataProcessorA, create_processor_a
from .module_b import DataProcessorB, process_data_b
from .module_c import DataValidatorC, validate_data_c, CombinedDataHandler


def create_test_system():
    """Create a test system that uses all modules"""
    processor_a = DataProcessorA()
    processor_b = DataProcessorB()
    validator_c = DataValidatorC()
    
    return {
        'processors': [processor_a, processor_b],
        'validator': validator_c,
        'combined_handler': CombinedDataHandler()
    }


def test_circular_dependencies():
    """Function to test the circular dependencies"""
    # This will trigger imports across all modules
    test_data = "sample_data"
    
    # Test A -> B -> C cycle
    result_a = create_processor_a().process(test_data)
    
    # Test B -> C -> A cycle  
    result_b = process_data_b(test_data)
    
    # Test C -> A cycle
    result_c = validate_data_c(test_data)
    
    return {
        'result_a': result_a,
        'result_b': result_b, 
        'result_c': result_c,
        'system': create_test_system()
    }


__all__ = [
    'module_a', 'module_b', 'module_c',
    'DataProcessorA', 'DataProcessorB', 'DataValidatorC',
    'create_test_system', 'test_circular_dependencies'
]
