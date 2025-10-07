# PyView - Interactive Python Dependency Visualization

<div align="center">

![License](https://img.shields.io/badge/License-BSD%202--Clause-blue.svg)
![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-009688.svg)

<img width="931" height="522" alt="image" src="https://github.com/user-attachments/assets/ee71b6ac-671b-4b52-8c27-89048f0119d5" />


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
<img width="2881" height="1392" alt="image" src="https://github.com/user-attachments/assets/cecee27a-9728-430a-b0d5-e9431c39a43f" />

</div>

<br/>

## 🖥️ 주요 기능 소개

### 📊 프로젝트 분석 및 시각화

<div align="center">

| **프로젝트 분석 설정** | **실시간 분석 진행률** |
|:---:|:---:|
| <img width="3360" height="1824" alt="image" src="https://github.com/user-attachments/assets/0d5e8da6-6e7e-4658-9e59-c3e11163d52e" /> | <img width="1744" height="516" alt="image" src="https://github.com/user-attachments/assets/3243adef-c4b0-4aca-afdc-a7aae8ebb74d" />|

</div>

### 🔍 5계층 상세 분석

<div align="center">

| **모듈 레벨 시각화** | **클래스 레벨 시각화** |
|:---:|:---:|
| <img width="703" height="599" alt="image" src="https://github.com/user-attachments/assets/3123f440-7139-449d-ad77-9ded4bb72163" /> | <img width="651" height="477" alt="image" src="https://github.com/user-attachments/assets/cb1a7b30-d72e-425a-8ac4-06a5c9410f1d" /> |

| **메서드 레벨 시각화** | **필드 레벨 시각화** |
|:---:|:---:|
| <img width="816" height="624" alt="image" src="https://github.com/user-attachments/assets/e196948e-deb7-4e93-91ea-af9d22eb880c" /> | <img width="1140" height="597" alt="image" src="https://github.com/user-attachments/assets/6e6598d0-d6f2-4a52-aab5-0402f98b86b5" /> |

</div>

### 🎯 핵심 기능

<div align="center">

| **의존성 경로 하이라이트** | **파일 탐색기에서 노드 선택** |
|:---:|:---:|
| <img width="522" height="544" alt="image" src="https://github.com/user-attachments/assets/5b9efda8-d790-423e-90f9-c42fd6546fc1" /> | <img width="620" height="439" alt="image" src="https://github.com/user-attachments/assets/35435051-dfbd-4abb-925c-dd47016cd294" /> |

| **통합 검색 시스템** | **코드 품질 메트릭** |
|:---:|:---:|
| <img width="1637" height="687" alt="image" src="https://github.com/user-attachments/assets/95fae1fd-1450-4f77-af60-c2871da3cd5d" /> | <img width="1675" height="776" alt="image" src="https://github.com/user-attachments/assets/6b1fa522-7b1e-4ec6-bb86-00320ca44b48" /> |

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
# 한 번에 실행 🚀
python start.py
```

> **수동 실행 (선택사항) 🔄**
> ```bash
> # 백엔드만 실행
> cd server && python app.py
>
> # 프론트엔드만 실행 (새 터미널)
> cd frontend && npm install && npm run dev
> ```

### ⚡ 3단계: 웹 브라우저에서 분석

```
http://localhost:3000
```

프로젝트 경로를 입력하고 분석 옵션을 설정한 후, **Start Analysis** 버튼을 클릭하세요!

## 🪟 Windows 사용자 주의사항

### 필수 설치 및 설정
```powershell
# Node.js 설치 확인
node --version
npm --version

# 인코딩 설정 (한글/이모지 오류 방지)
$env:PYTHONIOENCODING="utf-8"

# FastAPI 의존성 설치
pip install fastapi uvicorn
```

### 자주 발생하는 문제 해결
1. **"npm이 설치되지 않았습니다" 오류**
   - Node.js 재설치 시 "Add to PATH" 옵션 체크 필수
   - 설치 후 PowerShell 재시작 필요

2. **인코딩 오류 (cp949 codec 오류)**
   - PowerShell에서 `$env:PYTHONIOENCODING="utf-8"` 실행 후 재시도

3. **포트 충돌 오류**
   ```powershell
   # 사용 중인 포트 확인
   netstat -ano | findstr :3000
   netstat -ano | findstr :8000
   ```

4. **uvicorn 모듈 없음 오류**
   ```powershell
   pip install -r requirements.txt
   # 또는 개별 설치
   pip install fastapi uvicorn[standard]
   ```

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
├── 📜 setup.py                  # Python 패키지 설정
├── 📜 requirements.txt          # 개발 의존성
├── 📜 start.py                  # 통합 실행 스크립트 🚀
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


## 📄 라이센스

이 프로젝트는 **BSD 2-Clause License** 하에 배포됩니다.

자세한 라이센스 정보, 의존성 라이브러리 라이센스, 원본 프로젝트 Attribution은 **[LICENSES.md](LICENSES.md)** 파일을 참조하세요.

<br/>
<br/>

---

<div align="center">

🏆 **2025 오픈소스 개발자대회 출품작**

**PyView** - *Interactive Python Dependency Visualization*

</div>
