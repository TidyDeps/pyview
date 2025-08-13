# PyView Backend Analysis

## 기존 pydeps 백엔드 분석 결과

### 1. 핵심 데이터 플로우

```
target.py → py2depgraph.py → depgraph.py → depgraph2dot.py → dot.py
   ↓              ↓              ↓              ↓           ↓
대상 정의     ModuleFinder     그래프 구조    DOT 변환    렌더링
             기반 분석         & 메트릭       & 시각화    출력
```

### 2. py2depgraph.py 심층 분석

#### 2.1 MyModuleFinder 클래스
**기능**: Python의 ModuleFinder를 확장하여 의존성 추적
**핵심 메커니즘**:
- `import_hook()`: import 문 감지 및 처리
- `_add_import()`: 의존성 관계 기록 (`_depgraph` 딕셔너리)
- `load_module()`: .py/.pyc 파일 로딩 및 바이트코드 분석

**라인별 핵심 로직**:
```python
# py2depgraph.py:124-131 - import 훅킹
def import_hook(self, name, caller=None, fromlist=None, level=-1):
    old_last_caller = self._last_caller
    try:
        self._last_caller = caller
        return mf27.ModuleFinder.import_hook(self, name, caller, fromlist, level)
    finally:
        self._last_caller = old_last_caller

# py2depgraph.py:133-149 - 의존성 추가
def _add_import(self, module):
    if module is not None:
        if self._last_caller:
            # PYLIB_PATH 필터링으로 표준라이브러리 제외
            if self.include_pylib or not any(pylib_p):
                self._depgraph[self._last_caller.__name__][module.__name__] = module.__file__
```

#### 2.2 데이터 구조
```python
# _depgraph 구조 (핵심 의존성 데이터)
{
    "모듈A": {"모듈B": "/path/to/B.py", "모듈C": "/path/to/C.py"},
    "모듈B": {"모듈D": "/path/to/D.py"},
    ...
}

# _types 구조 (모듈 타입 정보)
{
    "모듈A": PY_SOURCE,     # .py 파일
    "모듈B": PY_COMPILED,   # .pyc 파일
    "모듈C": PKG_DIRECTORY, # 패키지 디렉토리
}
```

### 3. depgraph.py 심층 분석

#### 3.1 Source 클래스 (노드 표현)
**기능**: 의존성 그래프의 각 노드(모듈) 표현
**핵심 속성**:
```python
class Source:
    name: str           # 모듈명
    path: str           # 파일 경로
    imports: set        # 이 모듈이 import하는 모듈들
    imported_by: set    # 이 모듈을 import하는 모듈들
    bacon: int          # 메인 모듈로부터의 거리
    excluded: bool      # 제외 여부
```

**핵심 메트릭**:
```python
@property
def in_degree(self):    # 들어오는 의존성 수 (이 모듈을 import하는 모듈 수)
    return len(self.imports)

@property  
def out_degree(self):   # 나가는 의존성 수 (이 모듈이 import하는 모듈 수)
    return len(self.imported_by)
```

#### 3.2 DepGraph 클래스 (그래프 관리)
**기능**: 전체 의존성 그래프 관리 및 분석
**핵심 처리 과정**:

1. **그래프 구축** (`__init__` 메서드)
   ```python
   # depgraph.py:287-304 - 노드 생성
   for name, imports in depgraf.items():
       src = Source(name=self.source_name(name), imports=[...])
       self.add_source(src)
   ```

2. **세대 연결** (`connect_generations` 메서드)
   ```python  
   # depgraph.py:477-484 - 양방향 의존성 설정
   for src in self.sources.values():
       for _child in src.imports:
           child = self.sources[_child]
           child.imported_by.add(src.name)
   ```

3. **베이컨 거리 계산** (`calculate_bacon` 메서드)
   ```python
   # depgraph.py:486-500 - 메인 모듈로부터의 거리 계산
   def bacon(src, n):
       src.bacon = min(src.bacon, n)
       for imp in src.imports:
           bacon(self.sources[imp], n + 1)
   ```

4. **순환 의존성 탐지** (`find_import_cycles` 메서드)
   ```python
   # depgraph.py:454-475 - Kosaraju 알고리즘 사용
   scc = [c for c in graph.kosaraju() if len(c) > 1]
   self.cycles = [[n.src for n in c] for c in scc]
   ```

#### 3.3 Graph 클래스 (순환 의존성 분석)
**기능**: Kosaraju 알고리즘을 이용한 강한 연결 컴포넌트(SCC) 탐지
**핵심 알고리즘**:
```python
# depgraph.py:240-252 - Kosaraju 알고리즘
def kosaraju(self):
    stack = self.fill_order()           # 1단계: DFS로 완료 순서 계산
    transposed_graph = self.transpose() # 2단계: 그래프 전치
    # 3단계: 전치 그래프에서 DFS로 SCC 탐지
    while stack:
        node = stack.pop()
        if not visited[node.index]:
            component = transposed_graph.dfs_util(node, visited)
            scc_list.append(component)
```

### 4. ModuleFinder 동작 원리 (mf27.py)

#### 4.1 확장된 ModuleFinder
**기능**: Python 표준 ModuleFinder 확장 및 버그 수정
**주요 개선사항**:
```python
# mf27.py:24-25 - Python 3.8-3.10 버그 수정
if hasattr(modulefinder, '_find_module'):
    modulefinder._find_module = mfimp.find_module
```

#### 4.2 바이트코드 분석
**기능**: .pyc 파일 직접 분석 지원
```python
# mf27.py:28-62 - pyc 파일 로딩
def load_pyc(fp, mf=None):
    data = fp.read()
    if data[:4] != MAGIC_NUMBER:
        raise ImportError("Bad magic number in .pyc file")
    # 바이트코드에서 코드 객체 추출
    co = marshal.loads(data[pos:])
```

### 5. 확장 포인트 및 개선 방향

#### 5.1 현재 한계점
1. **모듈 레벨 분석만 지원**: Class/Method/Field 레벨 분석 부재
2. **정적 import만 감지**: 동적 import (`importlib`, `__import__`) 미지원
3. **타입 힌트 미활용**: 타입 기반 의존성 추적 없음
4. **성능 한계**: 대용량 프로젝트에서 메모리/시간 비효율

#### 5.2 PyView 확장 전략

**1단계: AST 분석 엔진 추가**
```python
# 새로운 pyview/ast_analyzer.py 모듈 계획
class ASTAnalyzer:
    def analyze_file(self, file_path: str) -> FileAnalysis
    def extract_classes(self, ast_tree) -> List[ClassInfo]
    def extract_methods(self, class_node) -> List[MethodInfo]
    def extract_references(self, ast_tree) -> List[Reference]
```

**2단계: 5계층 데이터 모델**
```python
# 새로운 pyview/models.py 구조 계획
@dataclass
class Package:
    name: str
    modules: List[Module]

@dataclass  
class Module:
    name: str
    classes: List[Class]
    functions: List[Function]
    
@dataclass
class Class:
    name: str
    methods: List[Method]
    fields: List[Field]
    inheritance: List[str]  # 상속 관계
```

**3단계: Legacy Bridge**
```python
# 기존 pydeps 결과와 새 분석 결과 병합
class LegacyBridge:
    def convert_pydeps_result(self, dep_graph: DepGraph) -> AnalysisResult
    def merge_ast_analysis(self, pydeps_result, ast_analysis) -> AnalysisResult
```

### 6. 성능 분석 및 최적화 방향

#### 6.1 현재 성능 특성
**메모리 사용**:
- `_depgraph`: O(모듈수 × 평균의존성수)
- `sources`: O(모듈수)
- 대형 프로젝트 (1000+ 모듈)에서 수백MB 메모리 사용

**시간 복잡도**:
- ModuleFinder 분석: O(파일수 × 평균파일크기)
- 그래프 구축: O(모듈수 + 의존성수)
- Kosaraju SCC: O(V + E)

#### 6.2 최적화 전략
1. **증분 분석**: 변경된 파일만 재분석
2. **병렬 처리**: 독립적인 모듈 동시 분석
3. **캐싱**: 분석 결과 SQLite 저장
4. **지연 로딩**: 필요한 데이터만 메모리 로딩

### 7. 다음 단계 계획

#### Phase 2 개발 우선순위
1. **AST 분석 엔진 구현** (T003A)
2. **5계층 데이터 모델 설계** (T003A)  
3. **기존 pydeps 통합 브리지** (T003A)
4. **성능 최적화 및 캐싱** (T004A)

#### 핵심 설계 원칙
- **기존 호환성 유지**: 모든 pydeps 기능 지원
- **점진적 확장**: 기존 코드 최대한 재사용
- **성능 우선**: 대용량 프로젝트 지원
- **확장성**: 플러그인 아키텍처 고려

이 분석을 바탕으로 PyView의 백엔드 확장 개발을 시작할 수 있습니다.