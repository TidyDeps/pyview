"""TestProject - Comprehensive test suite for PyView dependency analysis"""

from . import depth_chain
from . import exclude_test
from . import stdlib_test
from . import circular_deps
from . import quality_test

__all__ = [
    'depth_chain',
    'exclude_test',
    'stdlib_test',
    'circular_deps',
    'quality_test'
]

__version__ = "1.0.0"
__description__ = "Test project for PyView with various dependency patterns and quality metrics"