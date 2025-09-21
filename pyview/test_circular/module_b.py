"""
Test module B for circular dependency testing
B imports C, C imports A, A imports B (3-way cycle)
"""

from .module_c import DataValidatorC, clean_data_c


class DataProcessorB:
    def __init__(self):
        self.name = "Processor B"
        self.validator = DataValidatorC()
    
    def process(self, data):
        """Process data after cleaning with C"""
        cleaned = clean_data_c(data)
        return f"B processed: {cleaned}"
    
    def process_with_validation(self, data):
        """Process with validation using C"""
        if self.validator.is_valid(data):
            return self.process(data)
        return "Invalid data for B"
    
    def transform_data(self, data):
        """Transform data using specific B logic"""
        return {
            'original': data,
            'transformed': f"B_transformed_{data}",
            'processor': self.name
        }


def process_data_b(data):
    """Main processing function for module B"""
    processor = DataProcessorB()
    return processor.process(data)


def batch_process_b(data_list):
    """Batch processing with B"""
    processor = DataProcessorB()
    results = []
    for item in data_list:
        results.append(processor.transform_data(item))
    return results


# This creates a cycle: A -> B -> C -> A
def get_processor_a_info():
    """Function that imports A, creating the cycle"""
    from .module_a import create_processor_a
    processor_a = create_processor_a()
    return processor_a.get_info()
