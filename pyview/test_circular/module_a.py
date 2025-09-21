"""
Test module A for circular dependency testing
A imports B, B imports C, C imports A (3-way cycle)
"""

from .module_b import process_data_b
from .module_c import validate_data_c


class DataProcessorA:
    def __init__(self):
        self.name = "Processor A"
        self.processor_b = None
    
    def process(self, data):
        """Process data using processor B"""
        result = process_data_b(data)
        return f"A processed: {result}"
    
    def validate_and_process(self, data):
        """Validate using C and process using B"""
        if validate_data_c(data):
            return self.process(data)
        return "Invalid data"
    
    def get_info(self):
        return {
            'name': self.name,
            'type': 'primary_processor',
            'dependencies': ['module_b', 'module_c']
        }


def create_processor_a():
    """Factory function for creating processor A"""
    return DataProcessorA()


def process_with_a(data):
    """Utility function using processor A"""
    processor = create_processor_a()
    return processor.process(data)
