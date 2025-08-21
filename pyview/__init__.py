"""
PyView - WebGL 기반 Python 모듈 의존성 시각화 도구

5단계 분석이 가능한 pydeps 강화 버전:
- 패키지 레벨
- 모듈 레벨  
- 클래스 레벨
- 메소드 레벨
- 필드 레벨

thebjorn/pydeps 기반 (https://github.com/thebjorn/pydeps)
BSD 2-Clause 라이선스
"""

__version__ = "1.0.0"
__author__ = "PyView Contributors"
__license__ = "BSD 2-Clause"

from .analyzer_engine import analyze_project
from .models import AnalysisResult

__all__ = ["analyze_project", "AnalysisResult"]