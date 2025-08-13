# PyView Integration Analysis

## 프로젝트 현재 상태

### 기본 구조
- **Base Project**: pydeps 기반 (BSD 2-Clause License)
- **Version**: 3.0.1 (setup.py 기준)
- **Python 지원**: 3.8-3.12
- **Entry Points**: `pydeps` (기존), `pyview` (새로운)

### 핵심 파일 분석

#### 1. 데이터 플로우 핵심 파일
```
pydeps.py (메인 엔트리) 
  ↓
py2depgraph.py (ModuleFinder 기반 분석)
  ↓  
depgraph.py (그래프 구조)
  ↓
depgraph2dot.py (DOT 변환)
  ↓
dot.py (렌더링)
```

#### 2. 설정 및 CLI
- `cli.py`: CLI 인터페이스
- `configs.py`: 설정 관리 (.pydeps, pyproject.toml)
- `arguments.py`: 인자 파싱
- `target.py`: 분석 대상 처리

#### 3. 지원 모듈
- `colors.py`: 노드 색상 시스템
- `render_context.py`: 렌더링 옵션
- `mf27.py`, `mfimp.py`: ModuleFinder 확장

### 현재 설치된 의존성
```
setuptools>=70.0.0
PyYAML==6.0.2
stdlib-list>=0.6.0
tomlkit>=0.7.0
coverage>=5.5
pytest>=4.6
pytest-cov>=2.12.1
Sphinx>=1.7.6
```

### Git 브랜치 전략

#### 메인 브랜치
- `main`: 안정된 릴리즈 코드

#### 개발 브랜치 제안
```
feature/phase1-backend    # Backend 분석 엔진
feature/phase1-frontend   # React + WebGL 기초
feature/phase1-api        # FastAPI 서버
feature/integration       # 통합 작업
```

### 기존 강점 (유지할 부분)
1. **ModuleFinder 기반 정확한 분석**: `py2depgraph.py`
2. **유연한 설정 시스템**: `configs.py`  
3. **Graphviz 통합**: `dot.py`, `depgraph2dot.py`
4. **풍부한 테스트**: `tests/` 디렉토리

### 확장 포인트
1. **AST 분석 추가**: Class/Method 레벨 분석
2. **API 서버 연결**: FastAPI 백엔드
3. **웹 프론트엔드**: React + WebGL
4. **캐싱 시스템**: SQLite 기반

### 다음 단계
1. 개발 환경 설정 (venv, requirements)
2. Git 브랜치 생성
3. 작업 분할 및 인터페이스 정의