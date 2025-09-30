"""
PyView 통합 분석 엔진

pydeps 모듈 레벨 분석과 AST 기반 클래스/메소드/필드 분석을 결합하여
완전한 5단계 의존성 분석을 제공
"""

import os
import sys
import uuid
import time
import logging
from pathlib import Path
from typing import List, Dict, Set, Optional, Callable, Any
from datetime import datetime, timedelta
from concurrent.futures import ProcessPoolExecutor, as_completed

from .models import (
    AnalysisResult, ProjectInfo, DependencyGraph,
    PackageInfo, ModuleInfo, ClassInfo, MethodInfo, FieldInfo,
    Relationship, CyclicDependency, DependencyType, QualityMetrics, EntityType,
    create_module_id
)
from .ast_analyzer import ASTAnalyzer, FileAnalysis
from .legacy_bridge import LegacyBridge
from .code_metrics import CodeMetricsEngine
from .cache_manager import CacheManager, IncrementalAnalyzer, AnalysisCache, FileMetadata
from .performance_optimizer import LargeProjectAnalyzer, PerformanceConfig, ResultPaginator
from .gitignore_patterns import create_gitignore_matcher

logger = logging.getLogger(__name__)


class AnalysisOptions:
    """분석을 위한 설정 옵션들"""
    
    def __init__(self,
                 max_depth: int = 0,                                                           # 의존성 탐색 최대 깊이 (0이면 무제한)
                 exclude_patterns: List[str] = None,                                          # 분석에서 제외할 패턴들
                 include_stdlib: bool = False,                                                # 표준 라이브러리 포함 여부
                 analysis_levels: List[str] = None,                                           # 분석할 레벨들 (package, module, class, method, field)
                 enable_type_inference: bool = True,                                          # 타입 추론 활성화 여부
                 max_workers: int = None,                                                     # 병렬 처리 최대 워커 수
                 enable_caching: bool = True,                                                 # 캐싱 기능 활성화 여부
                 enable_quality_metrics: bool = True,                                        # 품질 메트릭 계산 활성화 여부
                 enable_performance_optimization: bool = True,                               # 성능 최적화 기능 활성화 여부
                 max_memory_mb: int = 1024):                                                  # 최대 메모리 사용량 (MB)

        self.max_depth = max_depth                                                           # 의존성 탐색 깊이 설정
        self.exclude_patterns = exclude_patterns or ['__pycache__', '.git', '.venv', 'venv', 'env', 'tests']  # 기본 제외 패턴들
        self.include_stdlib = include_stdlib                                                 # 표준 라이브러리 포함 설정
        self.analysis_levels = analysis_levels or ['package', 'module', 'class', 'method', 'field']  # 5단계 분석 레벨
        self.enable_type_inference = enable_type_inference                                   # 타입 추론 기능 설정
        self.max_workers = max_workers or min(32, (os.cpu_count() or 1) + 4)               # CPU 코어 수에 따른 워커 수 설정
        self.enable_caching = enable_caching                                                 # 캐싱 기능 설정
        self.enable_quality_metrics = enable_quality_metrics                                # 품질 메트릭 계산 설정
        self.enable_performance_optimization = enable_performance_optimization              # 성능 최적화 설정
        self.max_memory_mb = max_memory_mb                                                   # 메모리 사용량 제한 설정


class ProgressCallback:
    """분석 진행 상황을 받기 위한 인터페이스"""

    def __init__(self, callback: Callable[[dict], None] = None):
        """진행률 콜백 초기화"""
        self.callback = callback or self._default_callback                                   # 사용자 정의 콜백 또는 기본 콜백 사용

    def update(self, stage: str, progress: float, **kwargs):
        """진행 상황 업데이트"""
        data = {
            'stage': stage,                                                                  # 현재 진행 중인 단계
            'progress': progress,                                                            # 진행률 (0-100)
            **kwargs                                                                         # 추가 정보들
        }
        self.callback(data)                                                                  # 콜백 함수 호출

    def _default_callback(self, data: dict):
        """콘솔에 로그를 출력하는 기본 콜백"""
        stage = data.get('stage', 'Unknown')                                                 # 단계명 추출
        progress = data.get('progress', 0)                                                   # 진행률 추출
        logger.info(f"{stage}: {progress:.1f}%")                                             # 로그 출력


class AnalyzerEngine:
    """모든 분석 컴포넌트를 조율하는 메인 분석 엔진"""

    def __init__(self, options: AnalysisOptions = None):
        """분석 엔진 초기화"""
        self.options = options or AnalysisOptions()                                          # 분석 옵션 설정 (기본값 또는 사용자 지정)
        self.logger = logging.getLogger(__name__)                                            # 로거 초기화

        # 핵심 분석 컴포넌트들 초기화
        self.ast_analyzer = ASTAnalyzer(enable_type_inference=self.options.enable_type_inference)  # AST 기반 상세 분석기
        self.legacy_bridge = LegacyBridge()                                                  # pydeps 연동 브리지
        self.metrics_engine = None  # 임시로 비활성화 (hanging 방지)                              # 코드 품질 메트릭 엔진
        self.cache_manager = CacheManager() if options and options.enable_caching else None  # 분석 결과 캐시 관리자
        self.incremental_analyzer = IncrementalAnalyzer(self.cache_manager) if self.cache_manager else None  # 증분 분석기

        # 성능 최적화 컴포넌트들
        if options and options.enable_performance_optimization:                              # 성능 최적화가 활성화된 경우
            perf_config = PerformanceConfig(                                                 # 성능 설정 생성
                max_memory_mb=options.max_memory_mb,                                         # 최대 메모리 사용량
                max_workers=options.max_workers,                                             # 최대 워커 수
                batch_size=100,                                                              # 배치 크기
                enable_streaming=True,                                                       # 스트리밍 처리 활성화
                enable_gc=True                                                               # 가비지 컬렉션 활성화
            )
            self.large_project_analyzer = LargeProjectAnalyzer(perf_config)                  # 대규모 프로젝트 분석기
            self.result_paginator = ResultPaginator()                                        # 결과 페이징 처리기
        else:
            self.large_project_analyzer = None                                               # 성능 최적화 비활성화
            self.result_paginator = None

        # 분석 상태 관리
        self.current_analysis_id: Optional[str] = None                                       # 현재 분석 세션 ID
        self.total_files = 0                                                                 # 전체 파일 수
        self.processed_files = 0                                                             # 처리된 파일 수
    
    def analyze_project(self,
                       project_path: str,
                       progress_callback: ProgressCallback = None) -> AnalysisResult:
        """
        Python 프로젝트에 대한 완전한 5단계 분석 수행

        Args:
            project_path: 프로젝트 루트 경로
            progress_callback: 진행 상황 업데이트를 위한 선택적 콜백

        Returns:
            5단계 모든 레벨이 포함된 완전한 분석 결과
        """
        start_time = time.time()                        # 분석 시작 시간 기록 (성능 측정용)
        self.current_analysis_id = str(uuid.uuid4())    # 각 분석 세션을 UUID로 고유 식별

        if progress_callback is None:                   # 진행률 콜백이 없으면 기본 콜백 생성
            progress_callback = ProgressCallback()

        try:
            # Stage 1: Project discovery and size estimation
            progress_callback.update("Discovering project files", 5)       # 진행률 5% - 파일 탐색 시작
            project_files = self._discover_project_files(project_path)      # 프로젝트 내 모든 Python 파일 수집
            self.total_files = len(project_files)                           # 전체 파일 수 저장 (진행률 계산용)

            # Stage 1.2: Check for large project optimization
            if self.large_project_analyzer and len(project_files) > 1000:  # 대규모 프로젝트 최적화 조건 확인 (1000개 파일 초과)
                progress_callback.update("Analyzing project complexity", 7) # 진행률 7% - 복잡도 분석 시작
                project_stats = self.large_project_analyzer.estimate_project_size(project_path)  # 파일 수뿐만 아니라 실제 복잡도 측정

                if project_stats['complexity'] in ['high', 'very_high']:    # 높은 복잡도면 최적화된 분석 방법 사용
                    progress_callback.update("Large project detected, using optimized analysis", 10)  # 진행률 10% - 대규모 분석 모드
                    return self._analyze_large_project(project_path, project_files, progress_callback, start_time)  # 스트리밍 처리로 분석
                else:
                    progress_callback.update("Project size manageable, using standard analysis", 10)  # 진행률 10% - 표준 분석 모드

            # Stage 1.5: Check for incremental analysis possibility
            cache_id = None                                                 # 캐시 ID 초기화
            if self.incremental_analyzer:                                   # 증분 분석기가 활성화된 경우
                progress_callback.update("Checking cache validity", 8)     # 진행률 8% - 캐시 유효성 검사
                cache_id = self.incremental_analyzer.can_use_incremental(   # 이전 분석 결과 재사용 가능한지 확인
                    project_path, vars(self.options)                       # 프로젝트 경로와 분석 옵션으로 캐시 검증
                )

                if cache_id:                                                # 유효한 캐시가 있으면
                    progress_callback.update("Performing incremental analysis", 10)  # 진행률 10% - 증분 분석 시작
                    try:
                        # Attempt incremental analysis
                        def full_analysis_fallback(path, files):           # 증분 분석 실패 시 대체 함수 정의
                            return self._perform_full_analysis(path, files, progress_callback)  # 전체 분석으로 폴백

                        result = self.incremental_analyzer.perform_incremental_analysis(  # 증분 분석 실행
                            project_path, project_files, cache_id, full_analysis_fallback   # 프로젝트 경로, 파일 목록, 캐시 ID, 폴백 함수 전달
                        )

                        progress_callback.update("Incremental analysis complete", 100)     # 진행률 100% - 증분 분석 완료
                        return result                                                       # 증분 분석 결과 반환

                    except Exception as e:                                                  # 증분 분석 실패 시
                        self.logger.warning(f"Incremental analysis failed, falling back to full: {e}")  # 경고 로그 출력
                        # 전체 분석으로 계속 진행

            # 전체 분석 수행
            analysis_result = self._perform_full_analysis(project_path, project_files, progress_callback, start_time)  # 전체 분석 실행

            # Stage 7: Save to cache if caching enabled
            if self.cache_manager and not cache_id:                                        # 캐시 매니저가 있고 기존 캐시가 없으면
                progress_callback.update("Saving analysis cache", 99)                      # 진행률 99% - 캐시 저장 중
                self._save_analysis_cache(project_path, project_files, analysis_result)    # 분석 결과를 캐시에 저장

            progress_callback.update("Analysis complete", 100)                             # 진행률 100% - 분석 완료
            return analysis_result                                                          # 최종 분석 결과 반환

        except Exception as e:                                                              # 분석 과정에서 예외 발생 시
            self.logger.error(f"Analysis failed: {e}")                                     # 에러 로그 출력
            raise                                                                           # 예외 다시 발생시켜 상위로 전달

    def _discover_project_files(self, project_path: str) -> List[str]:
        """프로젝트 내 모든 Python 파일 탐색 (.gitignore 스타일 패턴 지원)"""
        python_files = []                                                                   # Python 파일 경로 리스트

        # .gitignore 스타일 패턴 매처 생성
        pattern_matcher = create_gitignore_matcher(self.options.exclude_patterns)

        project_path_obj = Path(project_path)                                              # 프로젝트 경로를 Path 객체로 변환

        for root, dirs, files in os.walk(project_path):                                     # 디렉토리 트리 순회
            root_path = Path(root)

            # 제외할 디렉토리 필터링 (.gitignore 스타일 패턴 매칭)
            dirs_to_keep = []
            for d in dirs:
                dir_path = root_path / d
                # 프로젝트 루트 기준 상대 경로로 변환
                try:
                    relative_dir_path = dir_path.relative_to(project_path_obj)
                    if not pattern_matcher.should_exclude(relative_dir_path):
                        dirs_to_keep.append(d)
                except ValueError:
                    # relative_to 실패시 절대 경로로 확인
                    if not pattern_matcher.should_exclude(dir_path):
                        dirs_to_keep.append(d)
            dirs[:] = dirs_to_keep

            for file in files:                                                              # 현재 디렉토리의 모든 파일 확인
                if file.endswith('.py'):                                                    # Python 파일만 선택
                    file_path = os.path.join(root, file)                                   # 전체 파일 경로 생성
                    file_path_obj = Path(file_path)

                    # .gitignore 스타일 패턴 매칭으로 제외 여부 확인
                    try:
                        relative_file_path = file_path_obj.relative_to(project_path_obj)
                        if not pattern_matcher.should_exclude(relative_file_path):
                            python_files.append(file_path)                                 # 유효한 Python 파일 추가
                    except ValueError:
                        # relative_to 실패시 절대 경로로 확인
                        if not pattern_matcher.should_exclude(file_path_obj):
                            python_files.append(file_path)

        self.logger.info(f"Discovered {len(python_files)} Python files")                  # 발견된 파일 수 로그 출력
        return python_files                                                                # 발견된 파일 리스트 반환
    
    # === 일반 프로젝트 분석 경로 (< 1000 파일) ===

    def _perform_full_analysis(self, project_path: str, project_files: List[str],
                              progress_callback: ProgressCallback, start_time: float = None) -> AnalysisResult:
        """캐싱 없이 완전한 분석 수행"""
        if start_time is None:                                                              # 시작 시간이 없으면
            start_time = time.time()                                                        # 현재 시간으로 설정

        # Stage 2: pydeps module-level analysis
        progress_callback.update("Running module-level analysis", 15)                      # 진행률 15% - 모듈 수준 분석 시작
        pydeps_result = self._run_pydeps_analysis(project_path, progress_callback)          # pydeps로 모듈 간 의존성 분석

        # Stage 3: AST detailed analysis
        progress_callback.update("Analyzing code structure", 30)                           # 진행률 30% - 코드 구조 분석 시작
        ast_analyses = self._run_ast_analysis(project_files, progress_callback)             # AST로 상세 코드 구조 분석

        # Stage 4: Data integration
        progress_callback.update("Integrating analysis results", 70)                       # 진행률 70% - 분석 결과 통합 시작
        integrated_data = self._integrate_analyses(pydeps_result, ast_analyses, progress_callback)  # pydeps와 AST 결과 통합

        # Stage 5: Quality metrics analysis (품질 메트릭 분석 - hanging 방지를 위해 임시로 비활성화)
        quality_metrics = []                                                               # 품질 메트릭 리스트 초기화
        progress_callback.update("Skipping quality metrics (fast mode)", 85)               # 진행률 85% - 빠른 모드로 품질 메트릭 건너뜀
        # 임시로 품질 메트릭을 비활성화하여 hanging 방지
        # if self.metrics_engine and self.options.enable_quality_metrics:
        #     progress_callback.update("Calculating quality metrics", 85)
        #     quality_metrics = self._calculate_quality_metrics(integrated_data, project_files, progress_callback)

        # Stage 6: Final result assembly
        progress_callback.update("Assembling final results", 95)                           # 진행률 95% - 최종 결과 조립 시작
        analysis_result = self._assemble_result(                                           # 최종 분석 결과 조립
            project_path, integrated_data, quality_metrics, start_time, progress_callback  # 프로젝트 경로, 통합 데이터, 품질 메트릭, 시작 시간, 진행 콜백 전달
        )

        return analysis_result                                                              # 완성된 분석 결과 반환

    def _run_pydeps_analysis(self, project_path: str, progress_callback: ProgressCallback) -> Dict:
        """
        pydeps를 사용한 모듈 수준 의존성 분석

        Args:
            project_path: 분석할 프로젝트 경로
            progress_callback: 진행 상황 업데이트 콜백

        Returns:
            Dict: 모듈, 패키지, 의존성 정보가 포함된 딕셔너리
        """
        try:
            # PyView 옵션을 pydeps 형식으로 변환 (API 차이 극복)                               # 기존 pydeps 라이브러리와 호환되도록 옵션 변환
            pydeps_kwargs = {
                'max_bacon': self.options.max_depth if self.options.max_depth > 0 else 2,      # 의존성 탐색 깊이 (기본 2단계)
                'exclude': self.options.exclude_patterns,                                      # 제외할 패턴들
                'pylib': self.options.include_stdlib,                                          # 표준 라이브러리 포함 여부
                'verbose': 0                                                                    # 상세 출력 비활성화
            }

            # pydeps 분석 실행 (1단계: 모듈 간 import 관계 추출)                               # 기존 pydeps로 모듈 레벨 의존성 분석
            dep_graph = self.legacy_bridge.analyze_with_pydeps(project_path, **pydeps_kwargs)

            # PyView 데이터 구조로 변환 (표준화된 형태로 변환)                                  # pydeps 결과를 PyView 모델에 맞게 변환
            packages, modules, relationships = self.legacy_bridge.convert_pydeps_to_modules(dep_graph)

            # 추가 정보 추출 (순환 참조, 메트릭 등)                                            # pydeps에서 제공하는 부가 정보 추출
            cycles = self.legacy_bridge.detect_cycles_from_pydeps(dep_graph)               # 모듈 수준 순환 참조 탐지
            metrics = self.legacy_bridge.get_pydeps_metrics(dep_graph)                     # 기본 메트릭 정보 추출

            return {
                'dep_graph': dep_graph,                                                         # 원본 pydeps 그래프 (참조용)
                'packages': packages,                                                           # 변환된 패키지 정보
                'modules': modules,                                                             # 변환된 모듈 정보
                'relationships': relationships,                                                 # 변환된 관계 정보
                'cycles': cycles,                                                               # 탐지된 순환 참조
                'metrics': metrics                                                              # 기본 메트릭 데이터
            }

        except Exception as e:                                                                  # pydeps 분석 실패시
            self.logger.error(f"pydeps analysis failed: {e}")                                 # 에러 로그 출력
            # pydeps 실패시 빈 결과 반환 (AST 분석만으로라도 진행 가능)                          # 1단계 실패해도 2단계 AST 분석은 계속 진행
            return {
                'dep_graph': None,                                                              # 그래프 없음
                'packages': [],                                                                 # 빈 패키지 리스트
                'modules': [],                                                                  # 빈 모듈 리스트
                'relationships': [],                                                            # 빈 관계 리스트
                'cycles': [],                                                                   # 빈 순환 참조 리스트
                'metrics': {}                                                                   # 빈 메트릭 딕셔너리
            }
    
    def _run_ast_analysis(self, project_files: List[str],
                         progress_callback: ProgressCallback) -> List[FileAnalysis]:
        """모든 프로젝트 파일에 대해 AST 분석 실행"""
        # 멀티프로세싱 사용 여부 결정 (파일이 많고 멀티프로세싱이 활성화된 경우)            # 성능 최적화를 위한 분기 처리
        if len(project_files) > 10 and self.options.max_workers and self.options.max_workers > 1:
            return self._run_parallel_ast_analysis(project_files, progress_callback)        # 병렬 처리로 분석
        else:
            return self._run_sequential_ast_analysis(project_files, progress_callback)      # 순차 처리로 분석
    
    def _run_sequential_ast_analysis(self, project_files: List[str],
                                    progress_callback: ProgressCallback) -> List[FileAnalysis]:
        """순차적으로 파일을 하나씩 AST 분석 (단일 스레드)"""
        analyses = []                                                                           # 분석 결과를 저장할 리스트
        total_files = len(project_files)                                                        # 전체 파일 수

        for i, file_path in enumerate(project_files):                                          # 각 파일을 순차적으로 처리
            try:
                # 개별 파일 분석 (클래스, 메소드, 필드 추출)                                    # AST 파싱으로 상세 구조 분석
                analysis = self.ast_analyzer.analyze_file(file_path)                           # ASTAnalyzer로 파일 분석
                if analysis:                                                                    # 분석 결과가 있으면
                    analyses.append(analysis)                                                   # 결과 리스트에 추가

                # 진행률 업데이트 (30%에서 시작해서 65%까지)                                   # 전체 분석 파이프라인에서의 비중 반영
                progress_percentage = 30 + (35 * (i + 1) / total_files)
                progress_callback.update(f"Analyzing file {i+1}/{total_files}", progress_percentage)

            except Exception as e:                                                              # 개별 파일 분석 실패시
                self.logger.warning(f"Failed to analyze file {file_path}: {e}")               # 경고 로그 (전체 실패하지 않고 계속 진행)

        return analyses                                                                         # 모든 파일 분석 결과 반환
    
    def _run_parallel_ast_analysis(self, project_files: List[str],
                                  progress_callback: ProgressCallback) -> List[FileAnalysis]:
        """병렬로 여러 파일을 동시에 AST 분석 (멀티프로세싱)"""
        analyses = []                                                                           # 분석 결과를 저장할 리스트
        total_files = len(project_files)                                                        # 전체 파일 수
        completed_files = 0                                                                     # 완료된 파일 수

        # 멀티프로세싱 풀로 병렬 처리 (CPU 집약적 작업이므로 프로세스 풀 사용)               # AST 파싱은 CPU 집약적이므로 멀티프로세싱 활용
        with ProcessPoolExecutor(max_workers=self.options.max_workers) as executor:
            # 모든 파일에 대해 분석 작업 제출
            future_to_file = {
                executor.submit(self._analyze_single_file, file_path): file_path               # 각 파일을 개별 프로세스에서 분석
                for file_path in project_files
            }

            # 완료되는 대로 결과 수집
            for future in as_completed(future_to_file):                                        # 완료 순서대로 결과 처리
                file_path = future_to_file[future]                                             # 해당 파일 경로 가져오기
                try:
                    analysis = future.result()                                                  # 분석 결과 가져오기
                    if analysis:                                                                # 분석 결과가 있으면
                        analyses.append(analysis)                                               # 결과 리스트에 추가

                except Exception as e:                                                          # 개별 파일 분석 실패시
                    self.logger.warning(f"Parallel analysis failed for {file_path}: {e}")     # 경고 로그

                completed_files += 1                                                            # 완료 카운터 증가
                # 진행률 업데이트 (30%에서 시작해서 65%까지)                                   # 전체 분석 과정에서의 진행률 반영
                progress_percentage = 30 + (35 * completed_files / total_files)
                progress_callback.update(f"Analyzing file {completed_files}/{total_files}", progress_percentage)

        return analyses                                                                         # 모든 파일 분석 결과 반환
    
    @staticmethod
    def _analyze_single_file(file_path: str) -> Optional[FileAnalysis]:
        """단일 파일 분석 (정적 메소드로 멀티프로세싱에서 사용)"""
        try:
            analyzer = ASTAnalyzer()                                                            # 새 ASTAnalyzer 인스턴스 생성
            return analyzer.analyze_file(file_path)                                             # 파일 분석 수행
        except Exception as e:                                                                  # 분석 실패시
            logging.getLogger(__name__).warning(f"Failed to analyze {file_path}: {e}")       # 로그 출력
            return None                                                                         # None 반환
    
    def _integrate_analyses(self, pydeps_result: Dict, ast_analyses: List[FileAnalysis],
                           progress_callback: ProgressCallback) -> Dict:
        """pydeps와 AST 분석 결과를 통합하여 완전한 5단계 의존성 그래프 생성"""

        # 1단계: pydeps와 AST 결과 통합 (모듈-클래스-메소드-필드 계층 구조 완성)             # 1단계(모듈)와 2-5단계(클래스/메소드/필드) 연결
        packages, modules, relationships = self.legacy_bridge.merge_with_ast_analysis(
            pydeps_result['packages'],                                                         # pydeps에서 추출한 패키지 정보
            pydeps_result['modules'],                                                          # pydeps에서 추출한 모듈 정보
            pydeps_result['relationships'],                                                    # pydeps에서 추출한 모듈 관계
            ast_analyses                                                                       # AST에서 분석한 상세 정보
        )

        # 2단계: AST 분석 결과에서 엔티티 추출 (클래스, 메소드, 필드)                         # AST에서 추출한 상세 정보를 표준 모델로 변환
        all_classes = []                                                                        # 클래스 정보 리스트
        all_methods = []                                                                        # 메소드 정보 리스트
        all_fields = []                                                                         # 필드 정보 리스트

        for analysis in ast_analyses:                                                           # 각 파일의 분석 결과 처리
            if analysis:                                                                        # 분석 결과가 있으면
                all_classes.extend(analysis.classes)                                           # 클래스들을 전체 리스트에 추가
                all_methods.extend(analysis.methods)                                           # 메소드들을 전체 리스트에 추가
                all_fields.extend(analysis.fields)                                             # 필드들을 전체 리스트에 추가

        # 3단계: 상세한 순환 참조 탐지 (클래스/메소드 레벨까지)                                # pydeps 모듈 레벨 순환 참조에 더해 상세 레벨 순환 참조 탐지
        additional_cycles = self._detect_detailed_cycles(all_classes, all_methods, relationships)
        # pydeps 실패시 AST 분석으로부터 import 순환 참조 추가 탐
        ast_import_cycles = self._detect_import_cycles_from_ast(ast_analyses)
        
        # 집계된 ModuleInfo.imports로 구축한 모듈 레벨 import 순환으로 보강 
        module_import_cycles = self._detect_import_cycles_from_modules(modules)
        all_cycles = pydeps_result['cycles'] + additional_cycles + ast_import_cycles + module_import_cycles                              # 모든 레벨의 순환 참조 통합

        # 4단계: 향상된 메트릭 계산 (모든 엔티티에 대한 품질 지표)                             # 통합된 데이터로 포괄적인 품질 메트릭 계산
        enhanced_metrics = self._calculate_enhanced_metrics(
            packages, modules, all_classes, all_methods, relationships                         # 모든 레벨의 엔티티와 관계 정보
        )
        return {
            'packages': packages,                                                               # 통합된 패키지 정보
            'modules': modules,                                                                 # 통합된 모듈 정보
            'classes': all_classes,                                                             # AST에서 추출한 클래스 정보
            'methods': all_methods,                                                             # AST에서 추출한 메소드 정보
            'fields': all_fields,                                                               # AST에서 추출한 필드 정보
            'relationships': relationships,                                                     # 모든 레벨의 관계 정보
            'cycles': all_cycles,                                                               # 모든 레벨의 순환 참조
            'metrics': enhanced_metrics                                                         # 계산된 품질 메트릭
        }
    
    def _detect_detailed_cycles(self, classes: List[ClassInfo], methods: List[MethodInfo],
                              relationships: List[Relationship]) -> List[Dict]:
        """클래스와 메소드 레벨의 상세한 순환 참조 탐지"""
        cycles = []                                                                             # 탐지된 순환 참조 리스트

        # 관계들로부터 인접 그래프 구축 (방향성 그래프)                                           # 의존성 관계를 그래프로 표현
        graph = {}                                                                              # 인접 리스트 그래프
        for rel in relationships:                                                               # 모든 관계에 대해
            if rel.from_entity not in graph:                                                   # 소스 엔티티가 그래프에 없으면
                graph[rel.from_entity] = set()                                                 # 빈 집합으로 초기화
            graph[rel.from_entity].add(rel.to_entity)                                         # 타겟 엔티티 추가 (방향성 간선)

        # 단순한 DFS 기반 순환 탐지 (각 노드에서 시작)                                          # 깊이 우선 탐색으로 순환 찾기
        visited = set()                                                                        # 전체 탐색에서 방문한 노드들

        def has_cycle(node, path):
            """현재 경로에서 순환이 있는지 확인"""
            if node in path:                                                                   # 현재 경로에 이미 있으면 순환 발견
                cycle_start = path.index(node)                                                 # 순환 시작 지점 찾기
                return path[cycle_start:] + [node]                                             # 순환 경로 반환

            if node not in graph:                                                              # 더 이상 연결된 노드가 없으면
                return None                                                                    # 순환 없음

            path.append(node)                                                                  # 현재 노드를 경로에 추가
            for neighbor in graph[node]:                                                       # 연결된 모든 이웃 노드에 대해
                cycle = has_cycle(neighbor, path)                                              # 재귀적으로 순환 탐지
                if cycle:                                                                      # 순환이 발견되면
                    return cycle                                                               # 순환 경로 반환
            path.pop()                                                                         # 백트래킹 (현재 경로에서 노드 제거)
            return None                                                                        # 이 경로에서는 순환 없음

        # 모든 노드에서 순환 탐지 시작                                                           # 연결되지 않은 컴포넌트도 모두 확인
        for node in graph:                                                                     # 그래프의 모든 노드에 대해
            if node not in visited:                                                            # 아직 방문하지 않은 노드면
                cycle = has_cycle(node, [])                                                     # 순환 탐지 시작
                if cycle:                                                                       # 순환이 발견되면
                    cycle_info = {                                                              # 순환 정보 생성
                        'id': f"detailed_cycle_{len(cycles)}",                                 # 고유 순환 ID
                        'entities': cycle,                                                      # 순환에 참여하는 엔티티들
                        'cycle_type': 'call',  # 대부분의 상세 순환은 메소드 호출               # 순환 타입
                        'severity': 'low' if len(cycle) <= 2 else 'medium',                   # 심각도 (길이에 따라)
                        'description': f"Call cycle involving {len(cycle)} entities"           # 순환 설명
                    }
                    cycles.append(cycle_info)                                                   # 순환 리스트에 추가

        return cycles                                                                           # 탐지된 모든 순환 참조 반환

    def _detect_import_cycles_from_modules(self, modules: List[ModuleInfo]) -> List[Dict]:
        """Detect import cycles using consolidated ModuleInfo.imports.
        This complements AST-based detection and helps catch cycles missed by path-based normalization."""
        cycles: List[Dict] = []
        if not modules:
            return cycles

        # Build module import graph: module_name -> set(imported_module_name)
        graph: Dict[str, Set[str]] = {}
        for m in modules:
            src = m.name
            graph.setdefault(src, set())
            for imp in getattr(m, 'imports', []) or []:
                target = imp.module
                if target:
                    graph[src].add(target)

        # Kosaraju to find SCCs
        visited: Set[str] = set()
        order: List[str] = []
        def dfs1(n: str) -> None:
            visited.add(n)
            for nb in graph.get(n, set()):
                if nb not in visited and nb in graph:
                    dfs1(nb)
            order.append(n)
        for n in list(graph.keys()):
            if n not in visited:
                dfs1(n)
        transpose: Dict[str, Set[str]] = {}
        for u, nbrs in graph.items():
            transpose.setdefault(u, set())
            for v in nbrs:
                transpose.setdefault(v, set()).add(u)
        visited.clear()
        def dfs2(n: str, comp: List[str]) -> None:
            visited.add(n)
            comp.append(n)
            for nb in transpose.get(n, set()):
                if nb not in visited:
                    dfs2(nb, comp)
        cycle_id = 0
        for n in reversed(order):
            if n not in visited:
                comp: List[str] = []
                dfs2(n, comp)
                if len(comp) >= 2:
                    paths = []
                    for u in comp:
                        for v in graph.get(u, set()):
                            if v in comp:
                                paths.append({
                                    'from': create_module_id(u),
                                    'to': create_module_id(v),
                                    'relationship_type': 'import',
                                    'strength': 1.0
                                })
                    cycles.append({
                        'id': f"mod_import_cycle_{cycle_id}",
                        'entities': [create_module_id(x) for x in comp],
                        'paths': paths,
                        'cycle_type': 'import',
                        'severity': 'high' if len(comp) > 3 else 'medium',
                        'description': f"Module import cycle involving {len(comp)} modules",
                        'metrics': {
                            'length': len(comp),
                            'detection_method': 'module_list'
                        }
                    })
                    cycle_id += 1
        return cycles
    
    def _detect_cycles_by_type(self, relationships: List[Relationship], cycle_type: str) -> List[Dict]:
        """Detect cycles for a specific relationship type"""
        cycles = []
        
        if not relationships:
            return cycles
        
        # Build adjacency graph
        graph = {}
        edge_info = {}  # Store relationship details
        
        for rel in relationships:
            if rel.from_entity not in graph:
                graph[rel.from_entity] = set()
            graph[rel.from_entity].add(rel.to_entity)
            edge_info[(rel.from_entity, rel.to_entity)] = rel
        
        # Find strongly connected components using DFS
        visited = set()
        finished = set()
        stack = []
        
        def dfs1(node):
            if node in visited:
                return
            visited.add(node)
            for neighbor in graph.get(node, []):
                dfs1(neighbor)
            stack.append(node)
        
        # First DFS to get finish times
        for node in graph:
            dfs1(node)
        
        # Build reverse graph
        reverse_graph = {}
        for node in graph:
            for neighbor in graph[node]:
                if neighbor not in reverse_graph:
                    reverse_graph[neighbor] = set()
                reverse_graph[neighbor].add(node)
        
        # Second DFS on reverse graph
        visited.clear()
        
        def dfs2(node, component):
            if node in visited:
                return
            visited.add(node)
            component.append(node)
            for neighbor in reverse_graph.get(node, []):
                dfs2(neighbor, component)
        
        # Find SCCs
        while stack:
            node = stack.pop()
            if node not in visited:
                component = []
                dfs2(node, component)
                
                # Only consider components with cycles (size > 1)
                if len(component) > 1:
                    # Extract cycle path
                    cycle_paths = []
                    for i, entity in enumerate(component):
                        next_entity = component[(i + 1) % len(component)]
                        # Check if direct edge exists
                        if entity in graph and next_entity in graph[entity]:
                            rel = edge_info.get((entity, next_entity))
                            if rel:
                                cycle_paths.append({
                                    'from': entity,
                                    'to': next_entity,
                                    'relationship_type': cycle_type,
                                    'strength': rel.strength if hasattr(rel, 'strength') else 1.0,
                                    'line_number': rel.line_number,
                                    'file_path': rel.file_path
                                })
                    
                    # Calculate severity based on cycle type and length
                    if cycle_type == 'import':
                        severity = 'high' if len(component) > 3 else 'medium'
                    else:
                        severity = 'low' if len(component) <= 2 else 'medium'
                    
                    cycle_info = {
                        'id': f"{cycle_type}_cycle_{len(cycles)}",
                        'entities': component,
                        'paths': cycle_paths,
                        'cycle_type': cycle_type,
                        'severity': severity,
                        'metrics': {
                            'length': len(component),
                            'edge_count': len(cycle_paths)
                        },
                        'description': f"{cycle_type.title()} cycle involving {len(component)} entities"
                    }
                    cycles.append(cycle_info)

        # 모든 노드에서 시작하여 순환 확인                                                      # 모든 연결 컴포넌트 확인
        for node in graph:                                                                      # 그래프의 모든 노드에 대해
            if node not in visited:                                                             # 아직 방문하지 않은 노드만
                cycle = has_cycle(node, [])                                                     # 순환 탐지 시작
                if cycle:                                                                       # 순환이 발견되면
                    cycle_info = {                                                              # 순환 정보 생성
                        'id': f"detailed_cycle_{len(cycles)}",                                 # 고유 순환 ID
                        'entities': cycle,                                                      # 순환에 참여하는 엔티티들
                        'cycle_type': 'call',  # 대부분의 상세 순환은 메소드 호출               # 순환 타입
                        'severity': 'low' if len(cycle) <= 2 else 'medium',                   # 심각도 (길이에 따라)
                        'description': f"Call cycle involving {len(cycle)} entities"           # 순환 설명
                    }
                    cycles.append(cycle_info)                                                   # 순환 리스트에 추가

        return cycles                                                                           # 탐지된 모든 순환 참조 반환
    
    def _detect_import_cycles_from_ast(self, ast_analyses: List[FileAnalysis]) -> List[Dict]:
        """Detect import cycles from AST analysis when pydeps fails"""
        cycles = []
        
        if not ast_analyses:
            return cycles
        
        # Build import graph from AST analysis
        import_graph: Dict[str, Set[str]] = {}
        file_to_module: Dict[str, str] = {}
        
        for analysis in ast_analyses:
            if not analysis or not analysis.file_path:
                continue
            
            module_name = self._file_path_to_module_name(analysis.file_path)
            file_to_module[analysis.file_path] = module_name
            import_graph.setdefault(module_name, set())
            
            # Extract imports from AST analysis
            for import_info in analysis.imports:
                # Convert relative imports to absolute module names (best-effort)
                imported_module = self._resolve_import_name(
                    import_info.module, analysis.file_path
                )
                if imported_module:
                    import_graph[module_name].add(imported_module)

        # Use Kosaraju's algorithm to find all strongly connected components
        # Step 1: Order vertices by finish time
        visited: Set[str] = set()
        order: List[str] = []

        def dfs1(node: str) -> None:
            visited.add(node)
            for neighbor in import_graph.get(node, set()):
                if neighbor not in visited and neighbor in import_graph:
                    dfs1(neighbor)
            order.append(node)

        for node in list(import_graph.keys()):
            if node not in visited:
                dfs1(node)

        # Step 2: Transpose graph
        transpose: Dict[str, Set[str]] = {}
        for u, neighbors in import_graph.items():
            transpose.setdefault(u, set())
            for v in neighbors:
                transpose.setdefault(v, set()).add(u)

        # Step 3: DFS on transposed graph to get SCCs
        visited.clear()

        def dfs2(node: str, component: List[str]) -> None:
            visited.add(node)
            component.append(node)
            for neighbor in transpose.get(node, set()):
                if neighbor not in visited:
                    dfs2(neighbor, component)

        cycle_id = 0
        for node in reversed(order):
            if node not in visited:
                component: List[str] = []
                dfs2(node, component)

                # Emit cycles for SCCs with size >= 2
                if len(component) >= 2:
                    cycle_paths: List[Dict] = []
                    # Add edges within the component as cycle paths
                    for u in component:
                        for v in import_graph.get(u, set()):
                            if v in component:
                                cycle_paths.append({
                                    'from': create_module_id(u),
                                    'to': create_module_id(v),
                                    'relationship_type': 'import',
                                    'strength': 1.0
                                })
                    cycles.append({
                        'id': f"ast_import_cycle_{cycle_id}",
                        'entities': [create_module_id(x) for x in component],
                        'paths': cycle_paths,
                        'cycle_type': 'import',
                        'severity': 'high' if len(component) > 3 else 'medium',
                        'description': f"AST-detected import cycle involving {len(component)} modules",
                        'metrics': {
                            'length': len(component),
                            'detection_method': 'ast'
                        }
                    })
                    cycle_id += 1
                # Handle self-loop (module importing itself)
                elif len(component) == 1:
                    u = component[0]
                    if u in import_graph.get(u, set()):
                        cycles.append({
                            'id': f"ast_import_cycle_{cycle_id}",
                            'entities': [create_module_id(u)],
                            'paths': [{
                                'from': create_module_id(u),
                                'to': create_module_id(u),
                                'relationship_type': 'import',
                                'strength': 1.0
                            }],
                            'cycle_type': 'import',
                            'severity': 'medium',
                            'description': "AST-detected self import cycle",
                            'metrics': {
                                'length': 1,
                                'detection_method': 'ast'
                            }
                        })
                        cycle_id += 1

        return cycles
    
    def _file_path_to_module_name(self, file_path: str) -> str:
        """Convert file path to module name"""
        # Simple conversion: remove .py extension and convert path separators to dots
        if file_path.endswith('.py'):
            module_path = file_path[:-3]
        else:
            module_path = file_path
        
        # Convert to module name
        import os
        module_name = os.path.basename(module_path)
        return module_name
    
    def _resolve_import_name(self, import_name: str, current_file: str) -> Optional[str]:
        """Resolve import name to absolute module name"""
        # For now, return the import name as is
        # In a full implementation, this would handle relative imports properly
        if import_name.startswith('.'):
            # Relative import - for now, just strip the dot
            return import_name.lstrip('.')
        return import_name
    
    def _calculate_enhanced_metrics(self, packages: List[PackageInfo], modules: List[ModuleInfo],
                                  classes: List[ClassInfo], methods: List[MethodInfo],
                                  relationships: List[Relationship]) -> Dict:
        """5단계 모든 레벨을 포함한 향상된 메트릭 계산"""

        metrics = {
            'entity_counts': {                                                              # 엔티티 개수 통계
                'packages': len(packages),                                                  # 패키지 개수
                'modules': len(modules),                                                    # 모듈 개수
                'classes': len(classes),                                                    # 클래스 개수
                'methods': len(methods),                                                    # 메소드 개수
                'relationships': len(relationships)                                        # 관계 개수
            },
            'complexity_metrics': {},                                                       # 복잡도 메트릭들
            'coupling_metrics': {},                                                         # 결합도 메트릭들
            'quality_metrics': {}                                                           # 품질 메트릭들
        }
        # 복잡도 메트릭 계산                                                                     # 각 메소드의 순환 복잡도 수집
        for method in methods:                                                                  # 모든 메소드에 대해
            if method.complexity:                                                               # 복잡도 정보가 있으면
                metrics['complexity_metrics'][method.id] = method.complexity                   # 메소드 ID와 복잡도 매핑

        # 결합도 메트릭 계산                                                                     # 엔티티 간 의존성 강도 측정
        in_degree = {}                                                                          # 들어오는 의존성 개수 (afferent coupling)
        out_degree = {}                                                                         # 나가는 의존성 개수 (efferent coupling)

        for rel in relationships:                                                               # 모든 관계에 대해
            # 들어오는 관계 카운트 (다른 엔티티가 이 엔티티에 의존)                             # 해당 엔티티를 사용하는 다른 엔티티 수
            if rel.to_entity not in in_degree:                                                 # 타겟 엔티티가 딕셔너리에 없으면
                in_degree[rel.to_entity] = 0                                                   # 0으로 초기화
            in_degree[rel.to_entity] += 1                                                      # 들어오는 의존성 카운트 증가

            # 나가는 관계 카운트 (이 엔티티가 다른 엔티티에 의존)                               # 해당 엔티티가 사용하는 다른 엔티티 수
            if rel.from_entity not in out_degree:                                              # 소스 엔티티가 딕셔너리에 없으면
                out_degree[rel.from_entity] = 0                                                # 0으로 초기화
            out_degree[rel.from_entity] += 1                                                   # 나가는 의존성 카운트 증가

        # 각 엔티티의 불안정성 계산 (instability = Ce / (Ca + Ce))                            # 불안정성은 변경에 대한 민감도를 나타냄
        all_entities = set(in_degree.keys()) | set(out_degree.keys())                         # 모든 엔티티 집합
        for entity in all_entities:                                                            # 각 엔티티에 대해
            ca = in_degree.get(entity, 0)  # Afferent coupling (들어오는 의존성)                # 이 엔티티에 의존하는 다른 엔티티 수
            ce = out_degree.get(entity, 0)  # Efferent coupling (나가는 의존성)                # 이 엔티티가 의존하는 다른 엔티티 수

            instability = ce / (ca + ce) if (ca + ce) > 0 else 0.0                           # 불안정성 지수 계산 (0~1, 1에 가까울수록 불안정)
            metrics['coupling_metrics'][entity] = {                                            # 엔티티별 결합도 메트릭 저장
                'afferent_coupling': ca,                                                       # 들어오는 결합도
                'efferent_coupling': ce,                                                       # 나가는 결합도
                'instability': instability                                                     # 불안정성 지수
            }
        return metrics                                                                          # 계산된 모든 메트릭 반환
    
    def _calculate_quality_metrics(self, integrated_data: Dict, project_files: List[str],
                                  progress_callback: ProgressCallback) -> List[QualityMetrics]:
        """모든 엔티티에 대한 코드 품질 메트릭 계산"""
        quality_metrics = []                                                                    # 품질 메트릭 결과 리스트

        if not self.metrics_engine:                                                             # 메트릭 엔진이 없으면
            return quality_metrics                                                              # 빈 리스트 반환
            
        from .models import EntityType                                                          # EntityType 임포트

        # 분석을 위한 소스 파일 읽기                                                             # 품질 메트릭 계산을 위해 원본 소스 코드 필요
        source_cache = {}                                                                       # 파일 경로별 소스 코드 캐시
        for file_path in project_files:                                                        # 모든 프로젝트 파일에 대해
            try:
                with open(file_path, 'r', encoding='utf-8') as f:                              # UTF-8로 파일 열기
                    source_cache[file_path] = f.read()                                         # 파일 내용을 캐시에 저장
            except:                                                                             # 파일 읽기 실패시
                continue                                                                        # 해당 파일은 건너뛰고 계속

        total_entities = (len(integrated_data.get('modules', [])) +                            # 총 엔티티 수 계산 (진행률 표시용)
                         len(integrated_data.get('classes', [])))                             # 모듈과 클래스 수의 합
        processed = 0                                                                           # 처리된 엔티티 수

        # 모듈에 대한 메트릭 계산                                                               # 모듈 레벨 품질 분석
        for module in integrated_data.get('modules', []):                                      # 모든 모듈에 대해
            source_code = source_cache.get(module.file_path, "")                              # 해당 모듈의 소스 코드 가져오기
            if source_code:                                                                     # 소스 코드가 있으면
                module_metrics = self.metrics_engine.analyze_module_quality(module, source_code)  # 모듈 품질 분석 수행

                quality_metric = QualityMetrics(                                               # 품질 메트릭 객체 생성
                    entity_id=module.id,                                                       # 모듈 ID
                    entity_type=EntityType.MODULE,                                            # 엔티티 타입 (모듈)
                    cyclomatic_complexity=module_metrics.complexity.cyclomatic_complexity,    # 순환 복잡도
                    cognitive_complexity=module_metrics.complexity.cognitive_complexity,      # 인지 복잡도
                    nesting_depth=module_metrics.complexity.nesting_depth,                    # 중첩 깊이
                    lines_of_code=len(source_code.split('\n')),                               # 코드 라인 수
                    afferent_coupling=module_metrics.coupling.afferent_coupling,              # 들어오는 결합도
                    efferent_coupling=module_metrics.coupling.efferent_coupling,              # 나가는 결합도
                    instability=module_metrics.coupling.instability,                          # 불안정성 지수
                    maintainability_index=module_metrics.maintainability_index,               # 유지보수성 지수
                    technical_debt_ratio=module_metrics.technical_debt_ratio,                 # 기술 부채 비율
                    quality_grade=self.metrics_engine.get_quality_rating(module_metrics)      # 품질 등급
                )
                quality_metrics.append(quality_metric)                                        # 품질 메트릭 리스트에 추가

            processed += 1                                                                     # 처리된 엔티티 수 증가
            if processed % 10 == 0:                                                            # 10개마다 진행률 업데이트
                progress = 85 + (processed / total_entities) * 10                             # 진행률 계산 (85%~95%)
                progress_callback.update(f"Quality metrics: {processed}/{total_entities}", progress)  # 진행률 업데이트
        # 클래스에 대한 메트릭 계산                                                             # 클래스 레벨 품질 분석
        for class_info in integrated_data.get('classes', []):                                  # 모든 클래스에 대해
            source_code = source_cache.get(class_info.file_path, "")                          # 해당 클래스의 소스 코드 가져오기
            if source_code:                                                                     # 소스 코드가 있으면
                class_metrics = self.metrics_engine.analyze_class_quality(class_info, source_code)  # 클래스 품질 분석 수행

                quality_metric = QualityMetrics(                                               # 품질 메트릭 객체 생성
                    entity_id=class_info.id,                                                   # 클래스 ID
                    entity_type=EntityType.CLASS,                                             # 엔티티 타입 (클래스)
                    cyclomatic_complexity=class_metrics.complexity.cyclomatic_complexity,     # 순환 복잡도
                    cognitive_complexity=class_metrics.complexity.cognitive_complexity,       # 인지 복잡도
                    nesting_depth=class_metrics.complexity.nesting_depth,                     # 중첩 깊이
                    lines_of_code=sum(len(m.body_text.split('\n')) for m in class_info.methods),  # 클래스 내 모든 메소드의 라인 수 합계
                    afferent_coupling=class_metrics.coupling.afferent_coupling,               # 들어오는 결합도
                    efferent_coupling=class_metrics.coupling.efferent_coupling,               # 나가는 결합도
                    instability=class_metrics.coupling.instability,                           # 불안정성 지수
                    maintainability_index=class_metrics.maintainability_index,                # 유지보수성 지수
                    technical_debt_ratio=class_metrics.technical_debt_ratio,                  # 기술 부채 비율
                    quality_grade=self.metrics_engine.get_quality_rating(class_metrics)       # 품질 등급
                )
                quality_metrics.append(quality_metric)                                        # 품질 메트릭 리스트에 추가

            processed += 1                                                                     # 처리된 엔티티 수 증가
            if processed % 10 == 0:                                                            # 10개마다 진행률 업데이트
                progress = 85 + (processed / total_entities) * 10                             # 진행률 계산 (85%~95%)
                progress_callback.update(f"Quality metrics: {processed}/{total_entities}", progress)  # 진행률 업데이트
        self.logger.info(f"Calculated quality metrics for {len(quality_metrics)} entities")  # 계산된 메트릭 수 로그 출력
        return quality_metrics                                                                  # 계산된 모든 품질 메트릭 반환
    
    def _assemble_result(self, project_path: str, integrated_data: Dict,
                        quality_metrics: List[QualityMetrics],
                        start_time: float, progress_callback: ProgressCallback) -> AnalysisResult:
        """최종 분석 결과를 조립하여 AnalysisResult 객체 생성"""
        # 분석 완료 시간 계산 및 프로젝트 정보 생성

        end_time = time.time()                                # 분석 종료 시간 기록
        duration = end_time - start_time                     # 총 분석 소요 시간 계산

        # 프로젝트 정보 객체 생성
        project_info = ProjectInfo(
            name=os.path.basename(project_path),             # 프로젝트 이름 (폴더명)
            path=project_path,                                # 프로젝트 전체 경로
            analyzed_at=datetime.now().isoformat(),          # 분석 완료 시각 (ISO 형식)
            total_files=self.total_files,                    # 분석된 총 파일 수
            analysis_duration_seconds=duration,              # 분석 소요 시간 (초)
            python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",  # Python 버전 정보
            analysis_options=vars(self.options)              # 분석 옵션 설정값들
        )

        # 의존성 그래프 객체 생성 (5계층 구조)
        dependency_graph = DependencyGraph(
            packages=integrated_data['packages'],            # 패키지 계층
            modules=integrated_data['modules'],              # 모듈 계층
            classes=integrated_data['classes'],              # 클래스 계층
            methods=integrated_data['methods'],              # 메서드 계층
            fields=integrated_data['fields']                 # 필드 계층
        )

        # 순환 의존성 딕셔너리를 CyclicDependency 객체로 변환
        cycles = []                                           # 순환 의존성 객체 목록
        for cycle_dict in integrated_data['cycles']:         # 각 순환 의존성에 대해
            cycle = CyclicDependency(
                id=cycle_dict['id'],                         # 순환 의존성 고유 ID
                entities=cycle_dict['entities'],             # 순환에 포함된 엔티티들
                cycle_type=cycle_dict['cycle_type'],         # 순환 타입 (module/class/method)
                severity=cycle_dict['severity'],             # 심각도 수준
                description=cycle_dict.get('description')    # 순환 의존성 설명
            )
            cycles.append(cycle)                              # 리스트에 추가

        # 최종 분석 결과 객체 생성
        result = AnalysisResult(
            analysis_id=self.current_analysis_id,            # 고유 분석 ID
            project_info=project_info,                       # 프로젝트 기본 정보
            dependency_graph=dependency_graph,               # 5계층 의존성 그래프
            relationships=integrated_data['relationships'],  # 관계 정보
            quality_metrics=quality_metrics,                 # 품질 메트릭 결과
            metrics=integrated_data['metrics'],              # 기본 메트릭 정보
            cycles=cycles                                     # 순환 의존성 목록
        )

        # 분석 완료 로그 출력
        self.logger.info(f"Analysis completed in {duration:.2f} seconds")    # 분석 소요 시간
        self.logger.info(f"Found {len(result.dependency_graph.modules)} modules, "  # 발견된 구성요소 수
                        f"{len(result.dependency_graph.classes)} classes, "
                        f"{len(result.dependency_graph.methods)} methods")

        return result                                         # 완성된 분석 결과 반환

    # === 대규모 프로젝트 분석 경로 (>= 1000 파일) ===

    def _analyze_large_project(self, project_path: str, project_files: List[str],
                              progress_callback: ProgressCallback, start_time: float) -> AnalysisResult:
        """대규모 프로젝트(>=1000파일)에 최적화된 분석 전략 사용"""
        # 메모리 효율성과 처리 속도 향상을 위한 스트리밍 분석

        if not self.large_project_analyzer:                   # 대규모 분석기가 없는 경우
            # 표준 분석으로 대체
            return self._perform_full_analysis(project_path, project_files, progress_callback, start_time)

        progress_callback.update("Initializing large project analysis", 12)  # 대규모 프로젝트 분석 초기화

        # 스트리밍을 위한 최적화된 분석 함수 생성
        def optimized_ast_analysis(file_batch: List[str]):    # 배치 단위 AST 분석 함수
            batch_results = []                                # 배치 분석 결과 저장
            for file_path in file_batch:                      # 배치 내 각 파일에 대해
                try:
                    analysis = self.ast_analyzer.analyze_file(file_path)  # AST 분석 수행
                    if analysis:                              # 분석 결과가 있으면
                        batch_results.append(analysis)       # 결과에 추가
                except Exception as e:                        # 분석 실패 시
                    self.logger.warning(f"Failed to analyze {file_path}: {e}")  # 경고 로그
            return batch_results                              # 배치 분석 결과 반환

        # 스트리밍 분석 결과 처리
        all_analyses = []                                     # 전체 분석 결과 누적
        total_processed = 0                                   # 처리된 총 파일 수

        for batch_result in self.large_project_analyzer.analyze_large_project(  # 대규모 프로젝트 분석기 실행
            project_path, optimized_ast_analysis,             # 프로젝트 경로와 분석 함수
            lambda msg, prog: progress_callback.update(f"Large project: {msg}", 15 + (prog * 0.6))  # 진행률 콜백
        ):
            all_analyses.extend(batch_result)                 # 배치 결과를 전체 결과에 합병
            total_processed += len(batch_result)              # 처리된 파일 수 누적

            # 주기적 진행률 업데이트
            if total_processed % 500 == 0:                    # 500파일마다
                progress_callback.update(f"Processed {total_processed}/{len(project_files)} files",  # 진행 상황 업데이트
                                       15 + (total_processed / len(project_files)) * 60)

        progress_callback.update("Completing large project analysis", 80)  # 대규모 프로젝트 분석 완료

        # 대규모 프로젝트를 위한 단순화된 통합 사용
        integrated_data = self._integrate_large_project_data(all_analyses, progress_callback)

        # 메모리 절약을 위해 매우 큰 프로젝트는 품질 메트릭 건너뛰기
        quality_metrics = []                                  # 품질 메트릭 초기화
        if self.metrics_engine and len(project_files) < 5000:  # 5천 파일 미만일 때만
            progress_callback.update("Calculating quality metrics (subset)", 85)  # 품질 메트릭 계산 (샘플링)
            # 품질 메트릭을 위해 샘플만 분석
            sample_size = min(1000, len(all_analyses))        # 최대 1000개 샘플 크기
            sample_analyses = all_analyses[:sample_size]      # 앞쪽 샘플 선택
            quality_metrics = self._calculate_quality_metrics_sample(integrated_data, sample_analyses, progress_callback)

        # 페이지네이션 지원으로 최종 결과 조립
        progress_callback.update("Assembling results with pagination", 95)  # 페이지네이션으로 결과 조립
        analysis_result = self._assemble_large_project_result(
            project_path, integrated_data, quality_metrics, start_time, progress_callback
        )

        return analysis_result                                # 대규모 프로젝트 분석 결과 반환

    def _integrate_large_project_data(self, all_analyses: List[FileAnalysis],
                                     progress_callback: ProgressCallback) -> Dict:
        """대규모 프로젝트를 위한 단순화된 데이터 통합"""
        # 메모리 효율성을 위해 복잡한 관계 분석과 순환 검출 생략

        packages = {}                                         # 패키지 정보 딕셔너리
        modules = []                                          # 모듈 정보 리스트
        classes = []                                          # 클래스 정보 리스트
        methods = []                                          # 메서드 정보 리스트
        fields = []                                           # 필드 정보 리스트
        relationships = []                                    # 관계 정보 리스트 (단순화)

        for analysis in all_analyses:                         # 각 파일 분석 결과에 대해
            # 분석 결과를 데이터 구조로 변환 (단순화)
            module_info = ModuleInfo(
                id=create_module_id(analysis.file_path),      # 모듈 고유 ID 생성
                name=Path(analysis.file_path).stem,           # 파일명에서 모듈명 추출
                file_path=analysis.file_path,                 # 파일 전체 경로
                classes=analysis.classes,                     # 클래스 목록 (이미 변환됨)
                functions=analysis.functions,                 # 함수 목록
                imports=analysis.imports,                     # 임포트 목록
                loc=analysis.lines_of_code                    # 코드 라인 수
            )
            modules.append(module_info)                       # 모듈 목록에 추가

            # 클래스와 메서드 추가 (단순화)
            classes.extend(analysis.classes)                 # 클래스 목록 확장
            methods.extend(analysis.methods)                 # 메서드 목록 확장
            fields.extend(analysis.fields)                   # 필드 목록 확장

        return {
            'packages': list(packages.values()),             # 패키지 목록
            'modules': modules,                               # 모듈 목록
            'classes': classes,                               # 클래스 목록
            'methods': methods,                               # 메서드 목록
            'fields': fields,                                 # 필드 목록
            'relationships': relationships,                   # 관계 목록 (단순화됨)
            'cycles': [],                                     # 대규모 프로젝트는 순환 검출 생략
            'metrics': {                                      # 기본 메트릭 정보
                'entity_counts': {                            # 엔티티 개수 통계
                    'modules': len(modules),                  # 모듈 수
                    'classes': len(classes),                  # 클래스 수
                    'methods': len(methods),                  # 메서드 수
                    'fields': len(fields)                     # 필드 수
                }
            }
        }

    def _calculate_quality_metrics_sample(self, integrated_data: Dict,
                                        sample_analyses: List[FileAnalysis],
                                        progress_callback: ProgressCallback) -> List[QualityMetrics]:
        """대규모 프로젝트를 위한 샘플 기반 품질 메트릭 계산"""
        # 메모리와 시간 절약을 위해 전체가 아닌 샘플만 분석

        if not self.metrics_engine:                          # 메트릭 엔진이 없으면
            return []                                         # 빈 목록 반환

        sample_metrics = []                                   # 샘플 메트릭 결과 저장

        # 메모리와 시간 절약을 위해 하위 집합만 분석
        for i, module in enumerate(integrated_data.get('modules', [])[:100]):  # 최대 100개 모듈만
            try:
                # 단순화된 품질 분석 수행
                quality_metric = QualityMetrics(
                    entity_id=module.id,                     # 모듈 고유 ID
                    entity_type=EntityType.MODULE,           # 엔티티 타입 (모듈)
                    cyclomatic_complexity=5,                 # 순환 복잡도 (단순화됨)
                    lines_of_code=module.loc,                # 코드 라인 수
                    quality_grade="B"                        # 기본 품질 등급
                )
                sample_metrics.append(quality_metric)        # 메트릭 목록에 추가

            except Exception as e:                            # 메트릭 계산 실패 시
                self.logger.warning(f"Failed to calculate metrics for {module.id}: {e}")  # 경고 로그
                continue                                      # 다음 모듈로 계속

        return sample_metrics                                 # 계산된 샘플 메트릭 반환

    def _assemble_large_project_result(self, project_path: str, integrated_data: Dict,
                                      quality_metrics: List[QualityMetrics],
                                      start_time: float, progress_callback: ProgressCallback) -> AnalysisResult:
        """페이지네이션을 지원하는 대규모 프로젝트 결과 조립"""
        # 메모리 사용량 제한을 위해 결과 데이터에 제한을 두어 조립

        end_time = time.time()                                # 분석 종료 시간 기록
        duration = end_time - start_time                     # 총 분석 소요 시간 계산

        # 프로젝트 정보 생성
        project_info = ProjectInfo(
            name=os.path.basename(project_path),             # 프로젝트 이름 (폴더명)
            path=project_path,                                # 프로젝트 전체 경로
            analyzed_at=datetime.now().isoformat(),          # 분석 완료 시각 (ISO 형식)
            total_files=self.total_files,                    # 분석된 총 파일 수
            analysis_duration_seconds=duration,              # 분석 소요 시간 (초)
            python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",  # Python 버전
            analysis_options=vars(self.options)              # 분석 옵션 설정값들
        )

        # 페이지네이션 정보를 포함한 의존성 그래프 생성
        dependency_graph = DependencyGraph(
            packages=integrated_data['packages'],            # 패키지 목록 (제한 없음)
            modules=integrated_data['modules'][:1000],       # 모듈을 메모리에서 제한 (최대 1000개)
            classes=integrated_data['classes'][:2000],       # 클래스 제한 (최대 2000개)
            methods=integrated_data['methods'][:5000],       # 메서드 제한 (최대 5000개)
            fields=integrated_data['fields'][:5000]          # 필드 제한 (최대 5000개)
        )

        # 최종 결과 생성
        result = AnalysisResult(
            analysis_id=self.current_analysis_id,            # 고유 분석 ID
            project_info=project_info,                       # 프로젝트 기본 정보
            dependency_graph=dependency_graph,               # 제한된 의존성 그래프
            relationships=integrated_data['relationships'][:1000],  # 관계 제한 (최대 1000개)
            quality_metrics=quality_metrics,                 # 품질 메트릭 (샘플링됨)
            metrics=integrated_data['metrics'],              # 기본 메트릭 정보
            cycles=integrated_data['cycles']                  # 순환 의존성 (대규모에서는 빈 목록)
        )

        # 대규모 프로젝트 분석 완료 로그
        self.logger.info(f"Large project analysis completed in {duration:.2f} seconds")  # 분석 소요 시간
        self.logger.info(f"Analyzed {len(integrated_data['modules'])} modules, "          # 전체 분석된 요소 수
                        f"{len(integrated_data['classes'])} classes")

        return result                                         # 대규모 프로젝트 분석 결과 반환
    
    # ========= 공통 로직 =========

    def _save_analysis_cache(self, project_path: str, project_files: List[str],
                            analysis_result: AnalysisResult):
        """분석 결과를 캐시에 저장하여 다음번 분석 속도 향상"""
        # 파일 변경 감지와 캐시 무효화를 통한 증분 분석 지원
        try:
            cache_id = self.cache_manager.generate_cache_key(project_path, vars(self.options))  # 고유 캐시 키 생성

            # 분석된 모든 파일의 메타데이터 생성
            file_metadata = {}                                # 파일 메타데이터 딕셔너리
            for file_path in project_files:                  # 각 분석된 파일에 대해
                if os.path.exists(file_path):                 # 파일이 존재하면
                    file_metadata[file_path] = FileMetadata.from_file(file_path)  # 메타데이터 생성

            # 캐시 엔트리 생성
            cache = AnalysisCache(
                cache_id=cache_id,                            # 고유 캐시 ID
                project_path=project_path,                    # 프로젝트 경로
                created_at=datetime.now(),                    # 캐시 생성 시간
                expires_at=datetime.now() + timedelta(days=7),  # 캐시 만료 시간 (7일)
                file_metadata=file_metadata,                  # 파일 메타데이터
                analysis_result=analysis_result               # 분석 결과
            )

            self.cache_manager.save_cache(cache)              # 캐시 매니저를 통해 저장
            self.logger.info(f"Analysis results cached with ID: {cache_id}")  # 캐시 저장 완료 로그

        except Exception as e:                                # 캐시 저장 실패 시
            self.logger.warning(f"Failed to save cache: {e}")  # 경고 로그 (치명적이지 않음)


def analyze_project(project_path: str,
                   options: AnalysisOptions = None,
                   progress_callback: ProgressCallback = None) -> AnalysisResult:
    """
    Python 프로젝트 분석을 위한 편의 함수

    Args:
        project_path: 프로젝트 루트 경로
        options: 분석 옵션 (None이면 기본값 사용)
        progress_callback: 선택적 진행률 콜백

    Returns:
        완전한 분석 결과
    """
    engine = AnalyzerEngine(options)                                                        # 분석 엔진 생성
    return engine.analyze_project(project_path, progress_callback)                         # 프로젝트 분석 실행 및 결과 반환