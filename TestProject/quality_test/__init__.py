"""Quality metrics testing package"""

from .complex_class import ComplexAnalyzer, DataProcessor
from .long_function import massive_data_transformer
from .duplicate_code import UserManager, ConfigManager, validate_email_format
from .high_coupling import ApplicationService

__all__ = [
    'ComplexAnalyzer',
    'DataProcessor',
    'massive_data_transformer',
    'UserManager',
    'ConfigManager',
    'validate_email_format',
    'ApplicationService'
]