# PyView Design Integration & Interface Specification

## 1. 통합 시스템 아키텍처 Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PyView System                              │
├─────────────────────────────────────────────────────────────────────┤
│  Frontend (React + WebGL)           │  Backend (Python + FastAPI)   │
│  Port: 3000                         │  Port: 8000                    │
│  ┌─────────────────────────────────┐ │ ┌─────────────────────────────┐ │
│  │ React Components                │ │ │ FastAPI Routes              │ │
│  │ ├── WebGL Graph Renderer       │ │ │ ├── /api/analyze            │ │
│  │ ├── Search Interface           │ │ │ ├── /api/search             │ │
│  │ ├── Navigation System          │ │ │ ├── /api/path               │ │
│  │ └── Control Panels             │ │ │ └── /ws/analysis            │ │
│  └─────────────────────────────────┘ │ └─────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │ ┌─────────────────────────────┐ │
│  │ State Management (Zustand)      │ │ │ Analysis Engine             │ │
│  │ ├── Graph State                │ │ │ ├── AST Analyzer            │ │
│  │ ├── Analysis State             │ │ │ ├── Legacy Bridge           │ │
│  │ ├── Search State               │ │ │ ├── 5-Layer Data Model      │ │
│  │ └── UI State                   │ │ │ └── Dependency Resolver     │ │
│  └─────────────────────────────────┘ │ └─────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │ ┌─────────────────────────────┐ │
│  │ API Client (Axios + WebSocket) │ │ │ Cache Manager (SQLite)      │ │
│  └─────────────────────────────────┘ │ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        File System                                  │
│              Python Source Code Projects                           │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 핵심 데이터 플로우

### 2.1 분석 요청 플로우
```
Frontend Request → FastAPI → Analysis Engine → SQLite Cache → Response
      │                                                           │
      ▼                                                           ▼
WebSocket Connection ←── Progress Updates ←── Background Task ────┘
```

### 2.2 상세 처리 단계
```
1. 사용자가 프로젝트 경로 입력 및 분석 시작
   └── POST /api/analyze {project_path, options}

2. FastAPI가 분석 작업을 백그라운드 태스크로 시작
   └── analysis_id 반환, WebSocket 연결 생성

3. Analysis Engine이 5단계로 분석 수행
   ├── 1단계: 기존 pydeps ModuleFinder로 모듈 레벨 분석
   ├── 2단계: 새로운 AST Analyzer로 클래스/메서드 분석
   ├── 3단계: Legacy Bridge로 데이터 병합
   ├── 4단계: 5-Layer Data Model로 구조화
   └── 5단계: SQLite Cache에 저장

4. 진행률과 결과를 WebSocket으로 실시간 전송
   └── Frontend가 실시간으로 진행률 표시

5. 분석 완료 후 WebGL로 시각화
   └── React 상태 업데이트 → WebGL 렌더링
```

## 3. 핵심 인터페이스 스펙

### 3.1 Backend → Frontend 데이터 포맷

#### AnalysisResult (통합 응답 포맷)
```typescript
interface AnalysisResult {
  analysis_id: string;
  project_info: {
    name: string;
    path: string;
    analyzed_at: string;
    total_files: number;
    analysis_duration_seconds: number;
  };
  dependency_graph: {
    packages: Package[];
    modules: Module[];
    classes: Class[];
    methods: Method[];
    fields: Field[];
  };
  relationships: Relationship[];
  metrics: {
    complexity_metrics: ComplexityMetrics;
    coupling_metrics: CouplingMetrics;
    cycles: CyclicDependency[];
  };
}

interface Package {
  id: string;
  name: string;
  path: string;
  modules: string[];  // module IDs
}

interface Module {
  id: string;
  name: string;
  file_path: string;
  package_id: string;
  classes: string[];  // class IDs
  functions: string[]; // function IDs
  imports: ImportInfo[];
  loc: number; // Lines of Code
}

interface Class {
  id: string;
  name: string;
  module_id: string;
  line_number: number;
  bases: string[]; // base class IDs
  methods: string[]; // method IDs
  fields: string[]; // field IDs
  decorators: string[];
  docstring?: string;
}

interface Method {
  id: string;
  name: string;
  class_id?: string; // null for module-level functions
  line_number: number;
  args: MethodArg[];
  return_annotation?: string;
  decorators: string[];
  calls: string[]; // called method/function IDs
  complexity: number; // cyclomatic complexity
}

interface Field {
  id: string;
  name: string;
  class_id: string;
  line_number: number;
  type_annotation?: string;
  default_value?: string;
}

interface Relationship {
  from: string; // entity ID
  to: string;   // entity ID  
  type: 'import' | 'inheritance' | 'composition' | 'call' | 'reference';
  line_number: number;
  strength: number; // 0.0 - 1.0 (관계 강도)
}
```

### 3.2 API 엔드포인트 상세 스펙

#### POST /api/analyze
```typescript
// Request
interface AnalyzeRequest {
  project_path: string;
  options: {
    max_depth?: number;           // 분석 깊이 (기본: 무제한)
    exclude_patterns?: string[];  // 제외할 파일 패턴
    include_stdlib?: boolean;     // 표준 라이브러리 포함 여부
    analysis_levels?: ('package' | 'module' | 'class' | 'method' | 'field')[];
    enable_type_inference?: boolean; // 타입 추론 활성화
  };
}

// Response
interface AnalyzeResponse {
  analysis_id: string;
  status: 'started';
  estimated_duration_seconds: number;
  websocket_url: string; // "/ws/analysis/{analysis_id}"
}
```

#### GET /api/analyze/{analysis_id}
```typescript
// Response
interface AnalysisStatusResponse {
  analysis_id: string;
  status: 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  current_stage?: string;
  result?: AnalysisResult; // status가 'completed'일 때만
  error?: {
    type: string;
    message: string;
    details: object;
  };
}
```

#### GET /api/search
```typescript
// Query Parameters
interface SearchQuery {
  q: string;
  type?: 'all' | 'package' | 'module' | 'class' | 'method' | 'field';
  analysis_id: string;
  limit?: number; // 기본: 50
  offset?: number; // 기본: 0
}

// Response
interface SearchResponse {
  results: SearchResult[];
  total_count: number;
  search_time_ms: number;
}

interface SearchResult {
  id: string;
  name: string;
  type: 'package' | 'module' | 'class' | 'method' | 'field';
  module: string;
  file_path: string;
  line_number: number;
  relevance_score: number; // 0.0 - 1.0
  context: string; // 주변 코드 컨텍스트
}
```

### 3.3 WebSocket 메시지 포맷

#### 진행률 업데이트
```typescript
interface ProgressMessage {
  type: 'progress_update';
  analysis_id: string;
  data: {
    progress: number; // 0-100
    stage: string; // "Scanning files", "Analyzing AST", "Building graph" etc.
    current_file?: string;
    files_processed: number;
    total_files: number;
    eta_seconds?: number;
  };
}
```

#### 완료 알림
```typescript
interface CompletionMessage {
  type: 'analysis_complete';
  analysis_id: string;
  data: {
    status: 'success' | 'partial' | 'failed';
    summary: {
      total_packages: number;
      total_modules: number;
      total_classes: number;
      total_methods: number;
      cycles_found: number;
      analysis_time_seconds: number;
    };
    warnings?: string[]; // 분석 중 발생한 경고들
  };
}
```

### 3.4 Frontend State Management

#### Graph Store Interface
```typescript
interface GraphStore {
  // 데이터
  analysisResult: AnalysisResult | null;
  
  // 시각화 상태
  selectedEntities: string[];
  hoveredEntity: string | null;
  viewMode: 'package' | 'module' | 'class' | 'method';
  layoutMode: 'force-directed' | 'hierarchical' | 'circular';
  
  // 필터
  entityTypeFilter: Set<'package' | 'module' | 'class' | 'method' | 'field'>;
  relationshipTypeFilter: Set<'import' | 'inheritance' | 'call' | 'reference'>;
  complexityFilter: [number, number]; // min, max
  
  // 액션
  setAnalysisResult: (result: AnalysisResult | null) => void;
  setSelectedEntities: (entityIds: string[]) => void;
  toggleEntitySelection: (entityId: string) => void;
  setViewMode: (mode: ViewMode) => void;
  
  // 계산된 값
  getVisibleNodes: () => GraphNode[];
  getVisibleEdges: () => GraphEdge[];
  getEntityDetails: (entityId: string) => EntityDetails | null;
}
```

## 4. WebGL 렌더링 인터페이스

### 4.1 그래프 노드 변환
```typescript
// Backend AnalysisResult → Frontend GraphNode 변환
function transformToGraphNodes(analysisResult: AnalysisResult, viewMode: ViewMode): GraphNode[] {
  switch (viewMode) {
    case 'package':
      return analysisResult.dependency_graph.packages.map(pkg => ({
        id: pkg.id,
        label: pkg.name,
        type: 'package',
        size: calculateNodeSize(pkg.modules.length),
        color: getPackageColor(pkg.name),
        position: { x: 0, y: 0, z: 0 }, // 레이아웃에서 계산
        metadata: pkg
      }));
      
    case 'module':
      return analysisResult.dependency_graph.modules.map(module => ({
        id: module.id,
        label: getModuleDisplayName(module.name),
        type: 'module',
        size: calculateNodeSize(module.classes.length + module.functions.length),
        color: getModuleColor(module.file_path),
        position: { x: 0, y: 0, z: 0 },
        metadata: module
      }));
      
    case 'class':
      return analysisResult.dependency_graph.classes.map(cls => ({
        id: cls.id,
        label: cls.name,
        type: 'class',
        size: calculateNodeSize(cls.methods.length),
        color: getClassColor(cls.module_id),
        position: { x: 0, y: 0, z: 0 },
        metadata: cls
      }));
      
    // ... method, field levels
  }
}
```

### 4.2 렌더링 성능 최적화
```typescript
interface RenderingOptions {
  maxVisibleNodes: number; // 10000 (성능 제한)
  lodDistance: [number, number, number]; // [high, medium, low] quality distances
  enableInstancing: boolean; // GPU 인스턴싱 사용
  enableFrustumCulling: boolean; // 화면 밖 객체 제거
  animationDuration: number; // 레이아웃 변경 애니메이션 시간 (ms)
}

// LOD 기반 렌더링
function renderWithLOD(nodes: GraphNode[], camera: Camera, options: RenderingOptions) {
  const visibleNodes = nodes
    .filter(node => isInFrustum(node, camera))
    .sort((a, b) => getDistanceToCamera(a, camera) - getDistanceToCamera(b, camera))
    .slice(0, options.maxVisibleNodes);
  
  const lodGroups = {
    high: visibleNodes.filter(node => getDistanceToCamera(node, camera) < options.lodDistance[0]),
    medium: visibleNodes.filter(node => {
      const distance = getDistanceToCamera(node, camera);
      return distance >= options.lodDistance[0] && distance < options.lodDistance[1];
    }),
    low: visibleNodes.filter(node => getDistanceToCamera(node, camera) >= options.lodDistance[1])
  };
  
  // 각 LOD 그룹을 다른 품질로 렌더링
  renderHighQualityNodes(lodGroups.high);
  renderMediumQualityNodes(lodGroups.medium);
  renderLowQualityNodes(lodGroups.low);
}
```

## 5. 에러 처리 및 복구 전략

### 5.1 Backend 에러 처리
```python
# pyview/api/error_handlers.py
@app.exception_handler(AnalysisError)
async def analysis_error_handler(request: Request, exc: AnalysisError):
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "type": "analysis_error",
                "message": exc.message,
                "details": {
                    "file_path": exc.file_path,
                    "line_number": exc.line_number,
                    "suggestions": exc.get_suggestions()
                },
                "analysis_id": exc.analysis_id
            }
        }
    )

class AnalysisError(Exception):
    def __init__(self, message: str, file_path: str = None, line_number: int = None, analysis_id: str = None):
        self.message = message
        self.file_path = file_path
        self.line_number = line_number
        self.analysis_id = analysis_id
    
    def get_suggestions(self) -> List[str]:
        """에러 상황별 해결 제안"""
        suggestions = []
        if "SyntaxError" in self.message:
            suggestions.append("Check for Python syntax errors in the file")
            suggestions.append("Ensure the file is valid Python code")
        elif "ImportError" in self.message:
            suggestions.append("Check if all dependencies are installed")
            suggestions.append("Verify the Python path is correct")
        return suggestions
```

### 5.2 Frontend 에러 복구
```typescript
// Error Boundary with Recovery
class AnalysisErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 에러 로깅
    console.error('Analysis Error:', error, errorInfo);
    
    // 사용자에게 복구 옵션 제공
    this.showRecoveryOptions(error);
  }

  showRecoveryOptions(error: Error) {
    const options = [];
    
    if (error.message.includes('WebGL')) {
      options.push('Switch to 2D rendering mode');
      options.push('Update your graphics drivers');
    } else if (error.message.includes('Analysis')) {
      options.push('Retry with simplified analysis options');
      options.push('Exclude problematic files from analysis');
    }
    
    // Recovery UI 표시
    this.setState({ recoveryOptions: options });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorRecoveryUI error={this.state.error} options={this.state.recoveryOptions} />;
    }

    return this.props.children;
  }
}
```

## 6. 개발 환경 및 빌드 설정

### 6.1 개발 서버 통합
```json
// package.json scripts
{
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd ../api && uvicorn main:app --reload --port 8000",
    "dev:frontend": "vite --port 3000",
    "build": "tsc && vite build",
    "build:full": "npm run build:backend && npm run build:frontend",
    "preview": "vite preview --port 3000"
  }
}
```

### 6.2 Proxy 설정 (개발 시 CORS 해결)
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      }
    }
  }
});
```

## 7. 배포 및 패키징

### 7.1 통합 배포 스크립트
```python
# pyview/cli.py에 추가
@click.command()
@click.option('--serve', is_flag=True, help='Start local web server')
@click.option('--port', default=8000, help='Server port')
@click.option('--open-browser', is_flag=True, help='Open browser automatically')
def serve(serve: bool, port: int, open_browser: bool):
    """Start PyView web interface"""
    if serve:
        import uvicorn
        import webbrowser
        import threading
        
        # 백그라운드에서 서버 시작
        def run_server():
            uvicorn.run("pyview.api.main:app", host="127.0.0.1", port=port, log_level="info")
        
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        
        if open_browser:
            # 서버 시작 대기 후 브라우저 열기
            import time
            time.sleep(2)
            webbrowser.open(f"http://localhost:{port}")
        
        print(f"PyView server running at http://localhost:{port}")
        print("Press Ctrl+C to stop the server")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Server stopped")
```

### 7.2 프론트엔드 번들링
```typescript
// 프로덕션 빌드 시 static 파일로 FastAPI에 포함
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../api/static',  // FastAPI static 디렉토리로 빌드
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          webgl: ['three'], // WebGL 관련 라이브러리 분리
          ui: ['antd']      // UI 라이브러리 분리
        }
      }
    }
  }
});
```

## 8. 테스트 전략

### 8.1 통합 테스트
```python
# tests/test_integration.py
import pytest
from fastapi.testclient import TestClient
from pyview.api.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_full_analysis_workflow(client):
    """전체 분석 워크플로우 테스트"""
    
    # 1. 분석 시작
    response = client.post("/api/analyze", json={
        "project_path": "tests/fixtures/sample_project",
        "options": {"max_depth": 3}
    })
    assert response.status_code == 200
    analysis_id = response.json()["analysis_id"]
    
    # 2. 분석 완료까지 대기
    import time
    for _ in range(30):  # 30초 타임아웃
        status_response = client.get(f"/api/analyze/{analysis_id}")
        status = status_response.json()["status"]
        
        if status == "completed":
            break
        elif status == "failed":
            pytest.fail(f"Analysis failed: {status_response.json()}")
        
        time.sleep(1)
    else:
        pytest.fail("Analysis timed out")
    
    # 3. 결과 검증
    result = status_response.json()["result"]
    assert "dependency_graph" in result
    assert len(result["dependency_graph"]["modules"]) > 0
    
    # 4. 검색 기능 테스트
    search_response = client.get("/api/search", params={
        "q": "class",
        "analysis_id": analysis_id
    })
    assert search_response.status_code == 200
    assert len(search_response.json()["results"]) > 0
```

### 8.2 E2E 테스트
```typescript
// e2e/analysis.spec.ts
import { test, expect } from '@playwright/test';

test('complete analysis workflow', async ({ page }) => {
  // 1. 앱 접속
  await page.goto('http://localhost:3000');
  
  // 2. 프로젝트 경로 입력
  await page.fill('input[placeholder*="project path"]', 'tests/fixtures/sample_project');
  
  // 3. 분석 시작
  await page.click('button:has-text("Analyze")');
  
  // 4. 진행률 확인
  await expect(page.locator('.progress-bar')).toBeVisible();
  
  // 5. 분석 완료 대기
  await expect(page.locator('.graph-canvas')).toBeVisible({ timeout: 30000 });
  
  // 6. 그래프 상호작용 테스트
  await page.click('.graph-canvas', { position: { x: 400, y: 300 } });
  await expect(page.locator('.node-details')).toBeVisible();
  
  // 7. 검색 기능 테스트
  await page.fill('input[placeholder*="Search"]', 'MyClass');
  await expect(page.locator('.search-results')).toContainText('MyClass');
});
```

## 9. 성능 벤치마크

### 9.1 분석 성능 목표
- **소규모 프로젝트** (< 100 파일): < 10초
- **중규모 프로젝트** (100-1000 파일): < 60초  
- **대규모 프로젝트** (1000+ 파일): < 300초
- **메모리 사용량**: < 2GB (대규모 프로젝트)

### 9.2 렌더링 성능 목표
- **60fps 유지**: 1000개 노드까지
- **30fps 이상**: 10000개 노드까지
- **초기 로딩**: < 3초 (중규모 프로젝트)
- **상호작용 지연**: < 100ms (클릭, 호버)

## 10. 다음 단계 실행 계획

### Phase 2: 구현 시작 (4주)
1. **Week 3-4**: AST 분석 엔진 및 FastAPI 서버 구현
2. **Week 5-6**: React + WebGL 기본 시각화 구현
3. **Week 7-8**: 통합 테스트 및 성능 최적화

각 브랜치에서 개발한 설계를 기반으로 점진적 구현 예정!