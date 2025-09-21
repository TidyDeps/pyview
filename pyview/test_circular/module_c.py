"""
Test module C for circular dependency testing
C imports A, A imports B, B imports C (3-way cycle)
"""

from .module_a import DataProcessorA, process_with_a


class DataValidatorC:
    def __init__(self):
        self.name = "Validator C"
        self.processor_a = DataProcessorA()
    
    def is_valid(self, data):
        """Validate data using basic rules"""
        if not data or len(str(data)) < 2:
            return False
        return True
    
    def validate_with_processing(self, data):
        """Validate and use processor A for additional checks"""
        basic_valid = self.is_valid(data)
        if basic_valid:
            # This creates the cycle: C -> A -> B -> C
            processed = process_with_a(data)
            return processed is not None
        return False
    
    def get_validation_report(self, data):
        """Generate validation report"""
        return {
            'data': data,
            'basic_valid': self.is_valid(data),
            'processor_valid': self.validate_with_processing(data),
            'validator': self.name
        }


def validate_data_c(data):
    """Main validation function for module C"""
    validator = DataValidatorC()
    return validator.is_valid(data)


def clean_data_c(data):
    """Clean data function"""
    if not data:
        return ""
    return str(data).strip().lower()


# Additional cycle: C -> A (direct)
def create_combined_processor():
    """Create a processor that combines A and C"""
    processor_a = DataProcessorA()
    validator_c = DataValidatorC()
    
    return {
        'processor': processor_a,
        'validator': validator_c,
        'combined_name': f"{processor_a.name} + {validator_c.name}"
    }


class CombinedDataHandler:
    """Class that uses both A and C, creating complex dependencies"""
    
    def __init__(self):
        self.processor = DataProcessorA()
        self.validator = DataValidatorC()
    
    def handle_data(self, data):
        """Handle data using both processor and validator"""
        if self.validator.is_valid(data):
            return self.processor.process(data)
        return "Data rejected by C"
    
    def get_dependencies(self):
        """Show dependencies - this creates more import relationships"""
        return {
            'processor_info': self.processor.get_info(),
            'validator_name': self.validator.name,
            'handler': 'CombinedDataHandler'
        }
