# PyView - Interactive Python Dependency Visualization

<div align="center">
<img width="800" height="463" alt="PyView 메인 화면" src="https://github.com/user-attachments/assets/5d0e2d12-d925-4970-a7dc-c193124979e2" />

  🏆 **2025 오픈소스 개발자대회 출품작**
  
  **프로젝트 기간** : 2025.06.30 ~

  [🎥 Demo Video](https://youtu.be/gdDv0QxzrF8)
</div>

<br/>

## ✨ PyView 프로젝트 소개

### More Than Visualization, Interactive Code Understanding

- PyView는 Python 프로젝트의 복잡한 의존성을 **실시간 상호작용형 웹 인터페이스**로 시각화하는 차세대 개발자 도구입니다.
- **5계층 분석** (Package → Module → Class → Method → Field)을 통한 심층적 코드 구조 탐색
- 기존 pydeps의 정적 이미지 생성을 넘어 **고성능 시각화**와 **실시간 검색** 제공
- **대규모 코드베이스** 리팩토링, 아키텍처 분석, 의존성 관리를 위한 도구

<br/>

## 🏗️ 시스템 아키텍처

<div align="center">
    <img width="800" height="387" alt="PyView 시스템 아키텍처" src="https://github.com/user-attachments/assets/78856e02-1241-48cc-9945-6ea16e78e008" />
</div>

<br/>

## 🖥️ 주요 기능 소개

### 📊 프로젝트 분석 및 시각화

<div align="center">

| **프로젝트 분석 설정** | **실시간 분석 진행률** |
|:---:|:---:|
| <img width="600" height="334" alt="프로젝트 분석 설정 화면" src="https://github.com/user-attachments/assets/c0e5fe0c-c8cf-44ea-a467-463da875c636" /> | <img width="600" height="177" alt="실시간 분석 진행률 표시" src="https://github.com/user-attachments/assets/db43b915-3a3e-4344-945a-ad95c735b7b6" /> |

| **파일 탐색기** | **계층적 의존성 그래프** |
|:---:|:---:|
| <img width="400" height="400" alt="파일 탐색기 인터페이스" src="https://github.com/user-attachments/assets/5eb0c67d-dcec-4cfe-bd0b-6a6c98bf54ea" /> | <img width="600" height="344" alt="계층적 의존성 그래프 시각화" src="https://github.com/user-attachments/assets/b1c15ef5-e0e6-4bdf-a1fc-061a549856fd" /> |

</div>

### 🔍 5계층 상세 분석

<div align="center">

| **모듈 레벨 시각화** | **클래스 레벨 시각화** |
|:---:|:---:|
| <img width="400" height="341" alt="모듈 간 의존성 관계" src="https://github.com/user-attachments/assets/0cc0e2cd-2cd5-47bc-8cd0-143e05d13464" /> | <img width="400" height="293" alt="클래스 간 상속 및 조합 관계" src="https://github.com/user-attachments/assets/27c6f4f8-b616-4fc9-93b8-1cfbc1dd8a73" /> |

| **메서드 레벨 시각화** | **필드 레벨 시각화** |
|:---:|:---:|
| <img width="400" height="306" alt="메서드 간 호출 관계" src="https://github.com/user-attachments/assets/498159a5-1414-47af-aca6-ea54674b85bd" /> | <img width="400" height="210" alt="클래스 멤버 변수 참조 관계" src="https://github.com/user-attachments/assets/1b829ed0-f286-4af4-93a0-7f249c261d1b" /> |

</div>

### 🎯 고급 기능

<div align="center">

| **의존성 경로 하이라이트** | **파일 탐색기에서 노드 선택** |
|:---:|:---:|
| <img width="400" height="417" alt="의존성 경로 추적 및 하이라이트" src="https://github.com/user-attachments/assets/9fdc5591-8335-453a-8301-8b26f3684e67" /> | <img width="400" height="283" alt="파일 탐색기에서 노드 선택 및 상세 정보" src="https://github.com/user-attachments/assets/79697768-fb99-4e68-a7b2-a6acfad170ae" /> |

| **통합 검색 시스템** | **코드 품질 메트릭** |
|:---:|:---:|
| <img width="600" height="252" alt="통합 검색 및 자동완성" src="https://github.com/user-attachments/assets/e6456f68-3ddd-4b1e-aee5-2e5ea5a9bd45" /> | <img width="600" height="277" alt="코드 품질 분석 및 메트릭" src="https://github.com/user-attachments/assets/c3b89586-9809-4e6c-a083-44a9ffb57a57" /> |

</div>

<br/>
<br/>

## 💻 기술 스택

| 구분                 | 기술 스택        | 버전 |
| -------------------- | ---------------- | ---- |
| **Backend Language** | Python | 3.8+ |
| **Web Framework**    | FastAPI | ≥0.104.1 |
| **ASGI Server**      | Uvicorn | ≥0.24.0 |
| **Data Validation**  | Pydantic | ≥2.4.2 |
| **Real-time**        | WebSockets | ≥12.0 |
| **Frontend Language**| TypeScript | 5.2.2 |
| **UI Framework**     | React | 18.2.0 |
| **Build Tool**       | Vite | 5.0.8 |
| **UI Components**    | Ant Design | 5.27.0 |
| **Graph Visualization** | Cytoscape.js | 3.33.1 |
| **HTTP Client**      | Axios | 1.11.0 |
| **Testing**          | pytest | ≥4.6 |

<br/>
<br/>
<br/>

## 🚀 실행 방법법

### 📋 시스템 요구사항

- **Python**: 3.8 이상
- **Node.js**: 18.0 이상 (프론트엔드 개발 시)
- **운영체제**: Windows, macOS, Linux
- **메모리**: 최소 4GB RAM (대형 프로젝트 분석 시 8GB 권장)

### ⚡ 1단계: 설치

```bash
# 개발용 설치
git clone https://github.com/TidyDeps/pyview.git
cd pyview
pip install -e .
```

### ⚡ 2단계: 실행

```bash
# 백엔드 서버 실행 
cd server && python app.py

# 프론트엔드 실행
cd frontend && npm install && npm run dev
```

### ⚡ 3단계: 웹 브라우저에서 분석

```
http://localhost:3000
```

프로젝트 경로를 입력하고 분석 옵션을 설정한 후, **Start Analysis** 버튼을 클릭하세요!

<br/>
<br/>
<br/>

## 🗂 프로젝트 구조

```
📦 PyView Project
├── 📂 pydeps/                   # 기존 pydeps (Legacy 분석 도구)
│   ├── 📜 pydeps.py             # CLI 진입점
│   ├── 📜 py2depgraph.py        # 모듈 의존성 분석
│   ├── 📜 depgraph.py           # 의존성 그래프 구조
│   ├── 📜 depgraph2dot.py       # DOT 포맷 변환
│   └── 📜 dot.py                # GraphViz 렌더링
│
├── 📂 pyview/                   # 새로운 분석 엔진 (Core)
│   ├── 📜 analyzer_engine.py    # 분석 오케스트레이터
│   ├── 📜 ast_analyzer.py       # AST 기반 코드 분석
│   ├── 📜 models.py             # 5-Layer 데이터 모델
│   ├── 📜 legacy_bridge.py      # pydeps 연동 브리지
│   ├── 📜 cache_manager.py      # 캐싱 및 증분 분석
│   └── 📜 performance_optimizer.py # 대규모 성능 최적화
│
├── 📂 frontend/                 # 프론트엔드 (React + TS)
│   ├── 📜 App.tsx               # 메인 앱
│   ├── 📂 components/           # UI 컴포넌트
│   │   ├── 📂 Analysis/         # 분석 폼, 진행상황
│   │   ├── 📂 Visualization/    # 그래프 시각화
│   │   ├── 📂 Search/           # 검색 UI
│   │   ├── 📂 QualityMetrics/   # 품질 메트릭
│   │   └── 📂 MultiView/        # 다중 뷰 모드
│   ├── 📂 hooks/                # React 훅
│   ├── 📂 services/             # API 통신
│   ├── 📂 types/                # TS 타입 정의
│   ├── 📜 package.json
│   └── 📜 vite.config.ts
│
├── 📂 server/                   # 백엔드 (FastAPI)
│   ├── 📜 app.py                # 메인 서버
│   ├── 📜 requirements.txt      # 의존성
│   └── 📜 demo_complex_data.py  # 데모 데이터
│
├── 📂 tests/                    # 테스트
│   ├── 📜 test_cli.py
│   ├── 📜 test_py2dep.py
│   └── 📂 pyview/               # 엔진 단위 테스트
│       ├── 📜 test_analyzer_engine.py
│       ├── 📜 test_ast_analyzer.py
│       └── 📜 test_models.py
│
├── 📂 docs/                     # 문서 (Sphinx)
│   ├── 📜 conf.py
│   ├── 📜 index.rst
│   └── 📂 _static/
│
├── 📜 setup.py                  # Python 패키지 설정
├── 📜 requirements.txt          # 개발 의존성
├── 📜 pytest.ini               # pytest 설정
├── 📜 .pydeps                   # pydeps 설정
└── 📜 README.md                 # 프로젝트 설명서
```

<br/>
<br/>

## 💡 주요 기능 상세

### 🔍 5계층 의존성 분석

PyView는 기존 도구들과 달리 **5단계 계층**으로 코드를 분석합니다:

- **📦 Package Level**: 패키지 간 의존성 관계
- **📄 Module Level**: 모듈 간 import 관계 (기존 pydeps 개선)
- **🏷️ Class Level**: 클래스 간 상속 및 조합 관계
- **⚙️ Method Level**: 메서드 간 호출 관계
- **📊 Field Level**: 클래스 멤버 변수 참조 관계

### 🎨 상호작용형 웹 시각화

- **Cytoscape.js** 기반 고성능 그래프 렌더링
- **실시간 줌/팬** 및 드래그 앤 드롭 네비게이션  
- **다양한 레이아웃 알고리즘**: Force-directed, Hierarchical, Circular
- **클러스터 확장/축소**: 복잡한 구조를 단계별로 탐색
- **의존성 경로 하이라이트**: 두 컴포넌트 간 연결 관계 추적

### 🔎 지능형 검색 시스템

- **통합 검색**: 패키지, 모듈, 클래스, 메서드명 동시 검색
- **실시간 자동완성**: 타이핑과 함께 즉시 결과 제공
- **타입별 필터링**: 검색 결과를 컴포넌트 유형별로 분류
- **파일 경로 표시**: 검색된 항목의 정확한 위치 정보

### 📊 코드 품질 메트릭

- **복잡도 분석**: 순환복잡도 및 코드 복잡도 측정
- **유지보수성 점수**: 코드 변경 용이성 평가
- **결합도 분석**: 모듈 간 의존성 강도 측정
- **기술부채 추적**: 리팩토링 우선순위 제공

### ⚡ 고성능 처리

- **증분 분석**: 변경된 파일만 재분석하여 속도 향상
- **WebSocket 실시간 진행률**: 분석 과정을 실시간 모니터링
- **메모리 최적화**: 대용량 프로젝트 (10,000+ 파일) 처리 가능
- **결과 캐싱**: 분석 결과를 로컬 데이터베이스에 저장

<br/>
<br/>


## 📄 라이센스 & 법적 고지

이 프로젝트는 **BSD 2-Clause License** 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

### 🙏 원본 프로젝트 Attribution

PyView는 [thebjorn/pydeps](https://github.com/thebjorn/pydeps) 프로젝트를 기반으로 개발되었습니다:

- **원본 저장소**: https://github.com/thebjorn/pydeps
- **원본 저작자**: Bjorn Pettersen (BP Consulting)
- **라이센스**: BSD 2-Clause License
- **Copyright**: (c) 2014, Bjorn Pettersen

### 📦 의존성 라이센스

주요 오픈소스 라이브러리들의 라이센스:
- **React**: MIT License
- **FastAPI**: MIT License  
- **Cytoscape.js**: MIT License
- **Ant Design**: MIT License

<br/>
<br/>

---

<div align="center">

🏆 **2025 오픈소스 개발자대회 출품작**

**PyView** - *Interactive Python Dependency Visualization*

</div>
