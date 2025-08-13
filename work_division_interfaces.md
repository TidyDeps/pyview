# PyView 작업 분할 & 인터페이스 정의

## 혼자 작업 시 순서 최적화

### Phase 1 우선순위 재조정 (혼자 작업용)
원래 3명 병렬 작업을 순차적으로 진행하되, 의존성을 고려한 순서:

1. **Backend Engine 기반 구축** (Person B 작업)
2. **API 시스템 구축** (Person A 작업)  
3. **Frontend 기초 구조** (Person C 작업)
4. **통합 작업** (전체)

## 핵심 인터페이스 정의

### 1. 데이터 모델 인터페이스

#### AnalysisResult (JSON)
```json
{
  "project_info": {
    "name": "string",
    "path": "string", 
    "analyzed_at": "timestamp",
    "analysis_config": {}
  },
  "dependency_graph": {
    "packages": [{"name": "str", "modules": [...]}],
    "modules": [{"name": "str", "classes": [...]}],
    "classes": [{"name": "str", "methods": [...]}], 
    "methods": [{"name": "str", "calls": [...]}],
    "fields": [{"name": "str", "references": [...]}]
  },
  "relationships": [
    {"from": "node_id", "to": "node_id", "type": "import|inheritance|call|reference"}
  ],
  "metrics": {
    "complexity": {},
    "coupling": {},
    "cycles": []
  }
}
```

### 2. API 엔드포인트 인터페이스

#### FastAPI Routes
```python
# /api/analyze
POST /api/analyze
{
  "project_path": "/path/to/project",
  "options": {
    "max_depth": 5,
    "exclude_patterns": ["test_*"],
    "include_stdlib": false
  }
}
→ {"analysis_id": "uuid", "status": "started"}

# /api/results/{analysis_id}
GET /api/results/{analysis_id}
→ AnalysisResult (above JSON)

# /api/search
GET /api/search?q=pattern&type=class|method|module
→ {"results": [{"name": "...", "type": "...", "path": "..."}]}
```

### 3. Frontend 컴포넌트 인터페이스

#### React Components
```typescript
// Graph Visualization
interface GraphViewProps {
  analysisData: AnalysisResult;
  selectedNodes: string[];
  onNodeSelect: (nodeId: string) => void;
  onNodeFilter: (filter: FilterOptions) => void;
}

// Search Interface
interface SearchProps {
  onSearch: (query: string, type: SearchType) => void;
  results: SearchResult[];
  loading: boolean;
}

// Navigation
interface NavigationProps {
  currentPath: string[];
  onNavigate: (path: string[]) => void;
  breadcrumbs: BreadcrumbItem[];
}
```

### 4. Backend 분석 엔진 인터페이스

#### AST Analyzer
```python
class ASTAnalyzer:
    def analyze_file(self, file_path: str) -> FileAnalysis:
        """파일 하나의 AST 분석"""
        pass
    
    def extract_classes(self, ast_tree) -> List[ClassInfo]:
        """클래스 정의 추출"""
        pass
        
    def extract_methods(self, class_node) -> List[MethodInfo]:
        """메서드 정의 추출"""
        pass
        
    def extract_references(self, ast_tree) -> List[Reference]:
        """참조 관계 추출"""
        pass
```

#### Legacy Bridge
```python
class LegacyBridge:
    def convert_pydeps_result(self, dep_graph) -> AnalysisResult:
        """기존 pydeps 결과를 새 포맷으로 변환"""
        pass
        
    def merge_ast_analysis(self, pydeps_result, ast_analysis) -> AnalysisResult:
        """AST 분석 결과와 기존 분석 병합"""
        pass
```

## 작업 순서 및 마일스톤

### Week 1-2: Backend Foundation
1. ✅ 프로젝트 구조 분석 완료
2. ⏳ AST 분석 엔진 개발
3. ⏳ 기존 pydeps 통합
4. ⏳ 5계층 데이터 모델 구현

### Week 3-4: API & Integration
1. FastAPI 서버 구축
2. 분석 엔드포인트 구현  
3. 캐싱 시스템 구현
4. API 테스트

### Week 5-6: Frontend Base
1. React 프로젝트 설정
2. 기본 레이아웃 구성
3. API 클라이언트 구현
4. 기본 그래프 시각화

### Week 7-8: Advanced Features  
1. WebGL 고성능 렌더링
2. 고급 검색 기능
3. 상호작용 시스템
4. 전체 통합 테스트

## 개발 환경 구성 필요사항

### Python 환경
```bash
python -m venv venv
source venv/bin/activate  # 또는 venv\Scripts\activate (Windows)
pip install -e .
pip install -r requirements.txt
```

### 추가 의존성 (Phase 2에서 필요)
```
fastapi>=0.68.0
uvicorn>=0.15.0
sqlalchemy>=1.4.0
aiosqlite>=0.17.0
websockets>=10.0
```

### Frontend 환경 (Phase 3에서 필요)  
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install three @types/three
npm install @tanstack/react-query axios
```

## 혼자 작업 시 주의사항

1. **점진적 구현**: 각 기능을 작은 단위로 나누어 완성
2. **테스트 우선**: 각 모듈 완성 시 즉시 테스트
3. **문서화**: 인터페이스 변경 시 즉시 문서 업데이트
4. **커밋 전략**: 기능 단위로 자주 커밋
5. **백업**: 주요 마일스톤마다 브랜치 백업