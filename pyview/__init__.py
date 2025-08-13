"""
PyView - Interactive Python module dependency visualization with WebGL

Enhanced version of pydeps with 5-layer analysis:
- Package level
- Module level  
- Class level
- Method level
- Field level

Based on thebjorn/pydeps (https://github.com/thebjorn/pydeps)
Licensed under BSD 2-Clause License
"""

__version__ = "1.0.0"
__author__ = "PyView Contributors"
__license__ = "BSD 2-Clause"

from .analyzer_engine import analyze_project
from .models import AnalysisResult

__all__ = ["analyze_project", "AnalysisResult"]