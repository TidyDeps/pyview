# PyView FastAPI Local Server Architecture Design

## 1. 전체 시스템 아키텍처

### 1.1 서버 구조
```
┌─────────────────────────────────────────────────────────────┐
│                    PyView Local Server                      │
├─────────────────────────────────────────────────────────────┤
│  FastAPI Application (localhost:8000)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   API Routes    │  │   WebSocket     │  │ Static Files │ │
│  │   /api/*        │  │   /ws/*         │  │   /static/*  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Analysis       │  │   Cache         │  │  File        │ │
│  │  Engine         │  │   Manager       │  │  Watcher     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │    SQLite       │  │   File System   │  │   Legacy     │ │
│  │    Cache        │  │   Source Code   │  │   pydeps     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 클라이언트-서버 통신
```
React Frontend (Port 3000)  ←→  FastAPI Server (Port 8000)
       │                              │
   ┌───▼────┐                    ┌────▼─────┐
   │ Axios  │ ← HTTP/REST API → │ FastAPI  │
   │Client  │                    │ Routes   │
   └────────┘                    └──────────┘
       │                              │
   ┌───▼────┐                    ┌────▼─────┐
   │WebSocket│ ← Real-time → │WebSocket │
   │Client  │     Updates      │ Handler  │
   └────────┘                    └──────────┘
```

## 2. FastAPI 애플리케이션 구조

### 2.1 디렉토리 구조
```
pyview/
├── api/
│   ├── __init__.py
│   ├── main.py              # FastAPI 앱 진입점
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── analyze.py       # 분석 관련 엔드포인트
│   │   ├── search.py        # 검색 관련 엔드포인트
│   │   ├── websocket.py     # WebSocket 핸들러
│   │   └── static.py        # 정적 파일 서빙
│   ├── models/
│   │   ├── __init__.py
│   │   ├── requests.py      # Pydantic 요청 모델
│   │   ├── responses.py     # Pydantic 응답 모델
│   │   └── websocket.py     # WebSocket 메시지 모델
│   ├── services/
│   │   ├── __init__.py
│   │   ├── analysis.py      # 분석 서비스 로직
│   │   ├── cache.py         # 캐시 관리 서비스
│   │   └── search.py        # 검색 서비스 로직
│   └── middleware/
│       ├── __init__.py
│       ├── cors.py          # CORS 설정
│       └── logging.py       # 로깅 미들웨어
└── cache/
    ├── __init__.py
    ├── manager.py           # 캐시 매니저
    └── schemas.py           # SQLite 스키마
```

### 2.2 main.py 구조
```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Routes
from .routes import analyze, search, websocket, static

# Middleware
from .middleware.cors import setup_cors
from .middleware.logging import setup_logging

# Services
from .services.cache import CacheService

app = FastAPI(
    title="PyView API",
    description="Local API server for PyView dependency visualization",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Middleware setup
setup_cors(app)
setup_logging(app)

# Routes registration
app.include_router(analyze.router, prefix="/api", tags=["analysis"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])

# Static files (React build)
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")

# Startup event
@app.on_event("startup")
async def startup_event():
    await CacheService.initialize()

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
```

## 3. API 엔드포인트 설계

### 3.1 분석 관련 API (/api/analyze)

#### POST /api/analyze
```python
# Request
{
  "project_path": "/path/to/project",
  "options": {
    "max_depth": 5,
    "exclude_patterns": ["test_*", "__pycache__"],
    "include_stdlib": false,
    "analysis_levels": ["package", "module", "class", "method", "field"]
  }
}

# Response
{
  "analysis_id": "uuid-string",
  "status": "started",
  "estimated_duration": 30,
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### GET /api/analyze/{analysis_id}
```python
# Response
{
  "analysis_id": "uuid-string", 
  "status": "completed|running|failed",
  "progress": 85,
  "result": {
    "project_info": {...},
    "dependency_graph": {...},
    "metrics": {...}
  },
  "error": null,
  "completed_at": "2024-01-01T00:05:30Z"
}
```

#### GET /api/analyze/{analysis_id}/progress
```python
# Response (실시간 진행률)
{
  "analysis_id": "uuid-string",
  "progress": 45,
  "current_stage": "Analyzing AST structures",
  "processed_files": 120,
  "total_files": 267,
  "eta_seconds": 25
}
```

### 3.2 검색 관련 API (/api/search)

#### GET /api/search
```python
# Query Parameters
{
  "q": "search_term",
  "type": "all|package|module|class|method|field", 
  "analysis_id": "uuid-string",
  "limit": 50,
  "offset": 0
}

# Response
{
  "results": [
    {
      "name": "MyClass",
      "type": "class",
      "module": "mymodule.submodule",
      "file_path": "/path/to/file.py",
      "line_number": 25,
      "relevance_score": 0.95
    }
  ],
  "total_count": 156,
  "search_time_ms": 12
}
```

#### GET /api/search/autocomplete
```python
# Query Parameters: q, analysis_id, limit=10

# Response
{
  "suggestions": [
    {"text": "MyClass", "type": "class", "score": 0.9},
    {"text": "my_function", "type": "method", "score": 0.8}
  ]
}
```

### 3.3 의존성 경로 API (/api/path)

#### GET /api/path/find
```python
# Query Parameters
{
  "from": "module.ClassA",
  "to": "module.ClassB", 
  "analysis_id": "uuid-string",
  "max_depth": 10
}

# Response
{
  "paths": [
    {
      "path": ["module.ClassA", "module.helper", "module.ClassB"],
      "length": 3,
      "weight": 1.2
    }
  ],
  "shortest_path_length": 3,
  "is_circular": false
}
```

### 3.4 영향도 분석 API (/api/impact)

#### GET /api/impact/analyze
```python
# Query Parameters
{
  "target": "module.MyClass",
  "analysis_id": "uuid-string",
  "depth": 3
}

# Response  
{
  "target": "module.MyClass",
  "impact_analysis": {
    "directly_affected": ["module.ClassB", "module.ClassC"],
    "indirectly_affected": ["module.ClassD", "module.ClassE"],
    "total_affected_count": 15,
    "risk_level": "medium",
    "recommendations": [
      "Consider creating interface for MyClass",
      "High coupling detected with ClassB"
    ]
  }
}
```

## 4. WebSocket 실시간 통신

### 4.1 WebSocket 엔드포인트
- `/ws/analysis/{analysis_id}` - 분석 진행률 실시간 업데이트
- `/ws/collaboration` - 다중 사용자 협업 (향후 확장)

### 4.2 WebSocket 메시지 포맷
```python
# 진행률 업데이트
{
  "type": "progress_update",
  "analysis_id": "uuid-string", 
  "data": {
    "progress": 65,
    "stage": "Building dependency graph",
    "files_processed": 180,
    "current_file": "package/module.py"
  }
}

# 완료 알림
{
  "type": "analysis_complete",
  "analysis_id": "uuid-string",
  "data": {
    "status": "success",
    "result_url": "/api/analyze/uuid-string",
    "summary": {
      "total_modules": 45,
      "cycles_found": 2,
      "analysis_time_seconds": 23
    }
  }
}

# 에러 알림
{
  "type": "analysis_error", 
  "analysis_id": "uuid-string",
  "data": {
    "error_type": "parsing_error",
    "message": "Failed to parse file: syntax_error.py",
    "details": {...}
  }
}
```

## 5. SQLite 캐싱 시스템

### 5.1 데이터베이스 스키마
```sql
-- 분석 세션 테이블
CREATE TABLE analysis_sessions (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    options TEXT NOT NULL,  -- JSON
    status TEXT NOT NULL,   -- started, running, completed, failed
    progress INTEGER DEFAULT 0,
    result TEXT,           -- JSON (분석 결과)
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    INDEX idx_project_path (project_path),
    INDEX idx_created_at (created_at)
);

-- 파일 변경 추적 테이블 (증분 분석용)
CREATE TABLE file_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id TEXT,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    last_modified TIMESTAMP,
    analysis_result TEXT,  -- JSON (파일별 분석 결과)
    FOREIGN KEY (analysis_id) REFERENCES analysis_sessions(id),
    INDEX idx_analysis_file (analysis_id, file_path),
    INDEX idx_file_hash (file_hash)
);

-- 의존성 캐시 테이블
CREATE TABLE dependency_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_module TEXT NOT NULL,
    to_module TEXT NOT NULL,
    dependency_type TEXT NOT NULL, -- import, inheritance, call, reference
    file_path TEXT,
    line_number INTEGER,
    analysis_id TEXT,
    FOREIGN KEY (analysis_id) REFERENCES analysis_sessions(id),
    INDEX idx_from_module (from_module),
    INDEX idx_to_module (to_module),
    INDEX idx_dependency_type (dependency_type)
);
```

### 5.2 캐시 관리 전략
```python
class CacheManager:
    async def get_cached_analysis(self, project_path: str, options: dict) -> Optional[AnalysisResult]
    async def store_analysis_result(self, analysis_id: str, result: AnalysisResult) -> None
    async def invalidate_cache(self, project_path: str) -> None
    async def get_incremental_changes(self, project_path: str, last_analysis_id: str) -> List[FileChange]
    async def cleanup_old_cache(self, days: int = 7) -> None
```

## 6. 에러 처리 및 로깅

### 6.1 에러 처리 전략
```python
# Custom Exception Classes
class PyViewAPIError(Exception):
    def __init__(self, message: str, error_code: str, details: dict = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}

class AnalysisError(PyViewAPIError):
    pass

class CacheError(PyViewAPIError):
    pass

# Global Exception Handler
@app.exception_handler(PyViewAPIError)
async def pyview_exception_handler(request: Request, exc: PyViewAPIError):
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "message": exc.message,
                "code": exc.error_code,
                "details": exc.details,
                "request_id": request.headers.get("x-request-id")
            }
        }
    )
```

### 6.2 로깅 구성
```python
# Structured Logging
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "component": "analysis_service",
  "analysis_id": "uuid-string",
  "message": "Starting AST analysis for 45 files",
  "context": {
    "project_path": "/path/to/project",
    "file_count": 45,
    "user_ip": "127.0.0.1"
  }
}
```

## 7. 성능 최적화

### 7.1 비동기 처리
- **Background Tasks**: 긴 분석 작업을 백그라운드에서 처리
- **Task Queue**: Celery 또는 Redis Queue 고려 (향후 확장)
- **Connection Pooling**: SQLite 연결 풀링

### 7.2 메모리 관리
- **Streaming Response**: 대용량 결과 스트리밍 전송
- **Pagination**: 검색 결과 페이지네이션
- **Memory Monitoring**: 메모리 사용량 모니터링 및 제한

## 8. 보안 고려사항

### 8.1 로컬 서버 보안
- **localhost 바인딩**: 외부 접근 차단 (127.0.0.1:8000만)
- **CORS 제한**: 특정 Origin만 허용
- **파일 시스템 접근 제한**: 분석 대상 디렉토리만 접근 허용

### 8.2 입력 검증
- **Path Traversal 방지**: `../` 등 위험한 경로 차단
- **파일 크기 제한**: 분석 대상 파일 크기 제한
- **Rate Limiting**: API 호출 빈도 제한

다음 단계에서는 이 설계를 바탕으로 실제 구현을 시작하겠습니다.