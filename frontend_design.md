# PyView React + WebGL Frontend Architecture Design

## 1. 전체 프론트엔드 아키텍처

### 1.1 기술 스택
```
React 18 + TypeScript + WebGL
├── UI Framework: React 18 (함수형 컴포넌트 + Hooks)
├── 타입 안전성: TypeScript 5.0+
├── 3D 렌더링: WebGL 2.0 (네이티브) 또는 Three.js
├── 상태 관리: Zustand (간단함) 또는 Redux Toolkit
├── HTTP 클라이언트: Axios
├── WebSocket: 네이티브 WebSocket API
├── 빌드 도구: Vite (빠른 개발 서버)
├── UI 컴포넌트: Ant Design / Material-UI
└── 스타일링: Tailwind CSS + CSS Modules
```

### 1.2 애플리케이션 구조
```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/           # 재사용 가능한 컴포넌트
│   │   ├── layout/          # 레이아웃 컴포넌트
│   │   ├── graph/           # 그래프 시각화 컴포넌트
│   │   ├── search/          # 검색 관련 컴포넌트
│   │   ├── common/          # 공통 UI 컴포넌트
│   │   └── controls/        # 컨트롤 패널 컴포넌트
│   ├── services/            # API 및 외부 서비스
│   │   ├── api.ts           # HTTP API 클라이언트
│   │   ├── websocket.ts     # WebSocket 서비스
│   │   └── storage.ts       # 로컬 스토리지 서비스
│   ├── stores/              # 상태 관리
│   │   ├── analysis.ts      # 분석 상태
│   │   ├── graph.ts         # 그래프 상태
│   │   ├── ui.ts            # UI 상태
│   │   └── search.ts        # 검색 상태
│   ├── types/               # TypeScript 타입 정의
│   │   ├── api.ts           # API 타입
│   │   ├── graph.ts         # 그래프 관련 타입
│   │   └── ui.ts            # UI 관련 타입
│   ├── hooks/               # 커스텀 React Hooks
│   │   ├── useAnalysis.ts   # 분석 관련 훅
│   │   ├── useWebGL.ts      # WebGL 관련 훅
│   │   └── useWebSocket.ts  # WebSocket 훅
│   ├── utils/               # 유틸리티 함수
│   │   ├── graph.ts         # 그래프 계산 유틸
│   │   ├── webgl.ts         # WebGL 헬퍼
│   │   └── format.ts        # 데이터 포맷팅
│   ├── assets/              # 정적 자원
│   │   ├── shaders/         # WebGL 셰이더
│   │   ├── textures/        # 텍스처 파일
│   │   └── icons/           # 아이콘 파일
│   ├── App.tsx              # 메인 앱 컴포넌트
│   ├── main.tsx             # 앱 진입점
│   └── vite-env.d.ts        # Vite 타입 정의
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 2. 핵심 컴포넌트 설계

### 2.1 메인 레이아웃 (`App.tsx`)
```tsx
import React from 'react';
import { Layout } from 'antd';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { StatusBar } from './components/layout/StatusBar';

const { Content, Sider } = Layout;

function App() {
  return (
    <Layout className="min-h-screen">
      {/* 상단 헤더 - 로고, 네비게이션, 설정 */}
      <Header />
      
      <Layout>
        {/* 좌측 사이드바 - 계층 네비게이션, 검색, 필터 */}
        <Sider width={320} className="bg-white shadow-lg">
          <Sidebar />
        </Sider>
        
        {/* 메인 컨텐츠 - 그래프 시각화 영역 */}
        <Content className="flex-1">
          <MainContent />
        </Content>
      </Layout>
      
      {/* 하단 상태바 - 진행률, 상태, 통계 */}
      <StatusBar />
    </Layout>
  );
}

export default App;
```

### 2.2 WebGL 그래프 컴포넌트 (`components/graph/WebGLRenderer.tsx`)
```tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { useWebGL } from '../../hooks/useWebGL';
import { useGraphStore } from '../../stores/graph';
import type { AnalysisResult, GraphNode, GraphEdge } from '../../types/graph';

interface WebGLRendererProps {
  analysisData: AnalysisResult | null;
  selectedNodes: string[];
  onNodeSelect: (nodeId: string, multi: boolean) => void;
  onNodeHover: (nodeId: string | null) => void;
}

export const WebGLRenderer: React.FC<WebGLRendererProps> = ({
  analysisData,
  selectedNodes,
  onNodeSelect,
  onNodeHover
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { graphState, setGraphState } = useGraphStore();
  
  // WebGL 초기화 및 렌더링 로직
  const {
    initWebGL,
    render,
    setData,
    setSelection,
    handleMouseEvent,
    cleanup
  } = useWebGL({
    onNodeSelect,
    onNodeHover
  });

  // 분석 데이터 변경 시 그래프 업데이트
  useEffect(() => {
    if (analysisData && canvasRef.current) {
      const nodes = transformToGraphNodes(analysisData);
      const edges = transformToGraphEdges(analysisData);
      setData(nodes, edges);
    }
  }, [analysisData, setData]);

  // 선택된 노드 업데이트
  useEffect(() => {
    setSelection(selectedNodes);
  }, [selectedNodes, setSelection]);

  // WebGL 컨텍스트 초기화
  useEffect(() => {
    if (canvasRef.current) {
      initWebGL(canvasRef.current);
      
      // 애니메이션 루프 시작
      const animate = () => {
        render();
        requestAnimationFrame(animate);
      };
      animate();
      
      return cleanup;
    }
  }, [initWebGL, render, cleanup]);

  // 마우스 이벤트 핸들러
  const handleCanvasMouseEvent = useCallback((event: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      handleMouseEvent(event.type, x, y, event);
    }
  }, [handleMouseEvent]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-pointer"
        onMouseDown={handleCanvasMouseEvent}
        onMouseMove={handleCanvasMouseEvent}
        onMouseUp={handleCanvasMouseEvent}
        onWheel={handleCanvasMouseEvent}
      />
      
      {/* 그래프 컨트롤 오버레이 */}
      <div className="absolute top-4 right-4">
        <GraphControls />
      </div>
      
      {/* 미니맵 */}
      <div className="absolute bottom-4 right-4">
        <MiniMap />
      </div>
    </div>
  );
};

// 데이터 변환 함수들
function transformToGraphNodes(data: AnalysisResult): GraphNode[] {
  // AnalysisResult → WebGL 렌더링용 노드 데이터 변환
  return data.dependency_graph.modules.map(module => ({
    id: module.name,
    label: module.name,
    type: 'module',
    size: Math.log(module.classes.length + 1) * 5 + 10,
    color: getNodeColor(module.name),
    position: { x: 0, y: 0, z: 0 }, // 레이아웃 알고리즘에서 계산
    metadata: module
  }));
}

function transformToGraphEdges(data: AnalysisResult): GraphEdge[] {
  // 의존성 관계를 엣지로 변환
  return data.relationships.map(rel => ({
    id: `${rel.from}-${rel.to}`,
    source: rel.from,
    target: rel.to,
    type: rel.type,
    weight: 1.0,
    color: getEdgeColor(rel.type)
  }));
}
```

### 2.3 검색 컴포넌트 (`components/search/SearchBox.tsx`)
```tsx
import React, { useState, useRef, useCallback } from 'react';
import { Input, Select, List, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useSearchStore } from '../../stores/search';
import { useAnalysisStore } from '../../stores/analysis';
import { debounce } from 'lodash-es';

const { Option } = Select;

interface SearchBoxProps {
  onResultSelect: (result: SearchResult) => void;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ onResultSelect }) => {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const { 
    searchResults, 
    searchLoading, 
    searchType,
    setSearchType,
    performSearch,
    clearResults
  } = useSearchStore();
  
  const { currentAnalysisId } = useAnalysisStore();

  // 디바운스된 검색 함수
  const debouncedSearch = useCallback(
    debounce(async (query: string, type: string) => {
      if (query.length >= 2 && currentAnalysisId) {
        await performSearch(query, type, currentAnalysisId);
        setIsDropdownOpen(true);
      } else {
        clearResults();
        setIsDropdownOpen(false);
      }
    }, 300),
    [currentAnalysisId, performSearch, clearResults]
  );

  // 입력 변경 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    debouncedSearch(value, searchType);
  };

  // 검색 타입 변경 핸들러
  const handleTypeChange = (type: string) => {
    setSearchType(type);
    if (inputValue.length >= 2) {
      debouncedSearch(inputValue, type);
    }
  };

  // 결과 선택 핸들러
  const handleResultSelect = (result: SearchResult) => {
    onResultSelect(result);
    setIsDropdownOpen(false);
    setInputValue(result.name);
  };

  return (
    <div className="relative">
      {/* 검색 입력창 */}
      <Input.Group compact className="flex">
        <Select
          value={searchType}
          onChange={handleTypeChange}
          className="w-24"
          size="small"
        >
          <Option value="all">All</Option>
          <Option value="module">Module</Option>
          <Option value="class">Class</Option>
          <Option value="method">Method</Option>
          <Option value="field">Field</Option>
        </Select>
        
        <Input
          placeholder="Search components..."
          prefix={<SearchOutlined />}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue && setIsDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
          className="flex-1"
          size="small"
        />
      </Input.Group>

      {/* 검색 결과 드롭다운 */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-md shadow-lg z-50 max-h-80 overflow-auto">
          {searchLoading ? (
            <div className="p-4 text-center">
              <Spin size="small" />
            </div>
          ) : searchResults.length > 0 ? (
            <List
              size="small"
              dataSource={searchResults}
              renderItem={(result) => (
                <List.Item
                  key={`${result.name}-${result.type}-${result.line_number}`}
                  className="cursor-pointer hover:bg-blue-50 px-3 py-2"
                  onClick={() => handleResultSelect(result)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <span className="font-medium">{result.name}</span>
                      <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-1 rounded">
                        {result.type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {result.module}:{result.line_number}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          ) : inputValue.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">
              No results found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
```

## 3. WebGL 렌더링 엔진 설계

### 3.1 WebGL 훅 (`hooks/useWebGL.ts`)
```typescript
import { useCallback, useRef } from 'react';
import { WebGLGraphRenderer } from '../utils/webgl/GraphRenderer';
import { LayoutEngine } from '../utils/graph/LayoutEngine';
import type { GraphNode, GraphEdge } from '../types/graph';

interface UseWebGLOptions {
  onNodeSelect: (nodeId: string, multi: boolean) => void;
  onNodeHover: (nodeId: string | null) => void;
}

export const useWebGL = ({ onNodeSelect, onNodeHover }: UseWebGLOptions) => {
  const rendererRef = useRef<WebGLGraphRenderer | null>(null);
  const layoutEngineRef = useRef<LayoutEngine | null>(null);

  const initWebGL = useCallback((canvas: HTMLCanvasElement) => {
    try {
      // WebGL 렌더러 초기화
      rendererRef.current = new WebGLGraphRenderer(canvas);
      layoutEngineRef.current = new LayoutEngine();
      
      // 이벤트 리스너 설정
      rendererRef.current.on('nodeClick', (nodeId: string, event: MouseEvent) => {
        onNodeSelect(nodeId, event.ctrlKey || event.metaKey);
      });
      
      rendererRef.current.on('nodeHover', (nodeId: string | null) => {
        onNodeHover(nodeId);
      });
      
    } catch (error) {
      console.error('Failed to initialize WebGL:', error);
    }
  }, [onNodeSelect, onNodeHover]);

  const setData = useCallback((nodes: GraphNode[], edges: GraphEdge[]) => {
    if (rendererRef.current && layoutEngineRef.current) {
      // 레이아웃 계산
      const layout = layoutEngineRef.current.calculateLayout(nodes, edges);
      
      // 렌더러에 데이터 설정
      rendererRef.current.setData(layout.nodes, layout.edges);
    }
  }, []);

  const render = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.render();
    }
  }, []);

  const setSelection = useCallback((selectedNodeIds: string[]) => {
    if (rendererRef.current) {
      rendererRef.current.setSelectedNodes(selectedNodeIds);
    }
  }, []);

  const handleMouseEvent = useCallback((
    eventType: string, 
    x: number, 
    y: number, 
    originalEvent: MouseEvent | React.MouseEvent
  ) => {
    if (rendererRef.current) {
      rendererRef.current.handleMouseEvent(eventType, x, y, originalEvent);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
  }, []);

  return {
    initWebGL,
    setData,
    render,
    setSelection,
    handleMouseEvent,
    cleanup
  };
};
```

### 3.2 WebGL 그래프 렌더러 (`utils/webgl/GraphRenderer.ts`)
```typescript
import { EventEmitter } from 'events';
import { ShaderManager } from './ShaderManager';
import { BufferManager } from './BufferManager';
import { CameraController } from './CameraController';
import type { GraphNode, GraphEdge, RenderOptions } from '../../types/graph';

export class WebGLGraphRenderer extends EventEmitter {
  private gl: WebGL2RenderingContext;
  private shaderManager: ShaderManager;
  private bufferManager: BufferManager;
  private cameraController: CameraController;
  
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private selectedNodes: Set<string> = new Set();
  private hoveredNode: string | null = null;
  
  private animationId: number = 0;
  private lastRenderTime: number = 0;
  
  constructor(canvas: HTMLCanvasElement) {
    super();
    
    // WebGL2 컨텍스트 획득
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      throw new Error('WebGL2 is not supported');
    }
    this.gl = gl;
    
    // 컴포넌트 초기화
    this.shaderManager = new ShaderManager(gl);
    this.bufferManager = new BufferManager(gl);
    this.cameraController = new CameraController(canvas);
    
    // WebGL 설정
    this.setupWebGL();
    
    // 리사이징 처리
    this.setupResize(canvas);
  }

  private setupWebGL() {
    const gl = this.gl;
    
    // 깊이 테스트 활성화
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    
    // 블렌딩 설정 (투명도 지원)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // 배경색 설정
    gl.clearColor(0.95, 0.95, 0.95, 1.0);
  }

  setData(nodes: GraphNode[], edges: GraphEdge[]) {
    this.nodes = nodes;
    this.edges = edges;
    
    // GPU 버퍼 업데이트
    this.bufferManager.updateNodeBuffer(nodes);
    this.bufferManager.updateEdgeBuffer(edges);
    
    // 카메라 초기 위치 설정
    this.cameraController.fitToNodes(nodes);
  }

  render() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastRenderTime;
    this.lastRenderTime = currentTime;
    
    const gl = this.gl;
    
    // 화면 클리어
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // 뷰 매트릭스 업데이트
    const viewMatrix = this.cameraController.getViewMatrix();
    const projectionMatrix = this.cameraController.getProjectionMatrix();
    
    // 엣지 렌더링 (노드보다 먼저)
    this.renderEdges(viewMatrix, projectionMatrix);
    
    // 노드 렌더링
    this.renderNodes(viewMatrix, projectionMatrix, deltaTime);
    
    // UI 오버레이 (선택, 호버 효과)
    this.renderOverlays(viewMatrix, projectionMatrix);
  }

  private renderNodes(viewMatrix: Float32Array, projectionMatrix: Float32Array, deltaTime: number) {
    const shader = this.shaderManager.getNodeShader();
    shader.use();
    
    // 유니폼 설정
    shader.setUniform('u_viewMatrix', viewMatrix);
    shader.setUniform('u_projectionMatrix', projectionMatrix);
    shader.setUniform('u_time', this.lastRenderTime * 0.001);
    
    // 노드별 렌더링
    for (const node of this.nodes) {
      const isSelected = this.selectedNodes.has(node.id);
      const isHovered = this.hoveredNode === node.id;
      
      // 노드 상태에 따른 시각적 효과
      const scale = isSelected ? 1.2 : isHovered ? 1.1 : 1.0;
      const alpha = node.type === 'module' ? 1.0 : 0.8;
      
      shader.setUniform('u_nodePosition', [node.position.x, node.position.y, node.position.z]);
      shader.setUniform('u_nodeSize', node.size * scale);
      shader.setUniform('u_nodeColor', [...node.color, alpha]);
      shader.setUniform('u_selected', isSelected);
      shader.setUniform('u_hovered', isHovered);
      
      // 인스턴스 렌더링 (원형 노드)
      this.bufferManager.renderNodeInstance();
    }
  }

  private renderEdges(viewMatrix: Float32Array, projectionMatrix: Float32Array) {
    const shader = this.shaderManager.getEdgeShader();
    shader.use();
    
    shader.setUniform('u_viewMatrix', viewMatrix);
    shader.setUniform('u_projectionMatrix', projectionMatrix);
    
    // 엣지 배치 렌더링
    this.bufferManager.renderEdges();
  }

  handleMouseEvent(eventType: string, x: number, y: number, originalEvent: MouseEvent | React.MouseEvent) {
    switch (eventType) {
      case 'mousedown':
        this.cameraController.startDrag(x, y);
        break;
        
      case 'mousemove':
        if (this.cameraController.isDragging()) {
          this.cameraController.updateDrag(x, y);
        } else {
          // 마우스 호버 처리
          const nodeId = this.pickNode(x, y);
          if (nodeId !== this.hoveredNode) {
            this.hoveredNode = nodeId;
            this.emit('nodeHover', nodeId);
          }
        }
        break;
        
      case 'mouseup':
        if (this.cameraController.isDragging()) {
          this.cameraController.endDrag();
        } else {
          // 노드 클릭 처리
          const nodeId = this.pickNode(x, y);
          if (nodeId) {
            this.emit('nodeClick', nodeId, originalEvent);
          }
        }
        break;
        
      case 'wheel':
        const wheelEvent = originalEvent as WheelEvent;
        this.cameraController.zoom(wheelEvent.deltaY, x, y);
        break;
    }
  }

  private pickNode(x: number, y: number): string | null {
    // GPU 기반 마우스 피킹
    const ray = this.cameraController.screenToRay(x, y);
    
    for (const node of this.nodes) {
      if (this.rayIntersectsNode(ray, node)) {
        return node.id;
      }
    }
    
    return null;
  }

  setSelectedNodes(nodeIds: string[]) {
    this.selectedNodes = new Set(nodeIds);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.shaderManager.dispose();
    this.bufferManager.dispose();
  }
}
```

## 4. 상태 관리 설계

### 4.1 그래프 상태 (`stores/graph.ts`)
```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AnalysisResult, GraphNode, GraphEdge, ViewMode, LayoutMode } from '../types/graph';

interface GraphState {
  // 데이터
  analysisResult: AnalysisResult | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  
  // 상태
  selectedNodes: string[];
  hoveredNode: string | null;
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  
  // 필터
  showOnlySelected: boolean;
  hideIsolatedNodes: boolean;
  minNodeSize: number;
  maxNodeSize: number;
  
  // 액션
  setAnalysisResult: (result: AnalysisResult | null) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleNodeSelection: (nodeId: string) => void;
  clearSelection: () => void;
  
  // 계산된 속성
  getFilteredNodes: () => GraphNode[];
  getFilteredEdges: () => GraphEdge[];
  getNodeNeighbors: (nodeId: string) => string[];
}

export const useGraphStore = create<GraphState>()(
  devtools(
    (set, get) => ({
      // 초기 상태
      analysisResult: null,
      nodes: [],
      edges: [],
      selectedNodes: [],
      hoveredNode: null,
      viewMode: 'graph',
      layoutMode: 'force-directed',
      showOnlySelected: false,
      hideIsolatedNodes: false,
      minNodeSize: 5,
      maxNodeSize: 50,

      // 액션
      setAnalysisResult: (result) => set((state) => {
        if (!result) {
          return { 
            analysisResult: null, 
            nodes: [], 
            edges: [], 
            selectedNodes: [],
            hoveredNode: null 
          };
        }

        const nodes = transformAnalysisToNodes(result);
        const edges = transformAnalysisToEdges(result);
        
        return {
          analysisResult: result,
          nodes,
          edges
        };
      }),

      setSelectedNodes: (nodeIds) => set({ selectedNodes: nodeIds }),

      setHoveredNode: (nodeId) => set({ hoveredNode: nodeId }),

      setViewMode: (mode) => set({ viewMode: mode }),

      setLayoutMode: (mode) => set({ layoutMode: mode }),

      toggleNodeSelection: (nodeId) => set((state) => {
        const isSelected = state.selectedNodes.includes(nodeId);
        return {
          selectedNodes: isSelected
            ? state.selectedNodes.filter(id => id !== nodeId)
            : [...state.selectedNodes, nodeId]
        };
      }),

      clearSelection: () => set({ selectedNodes: [], hoveredNode: null }),

      // 계산된 속성
      getFilteredNodes: () => {
        const state = get();
        let filteredNodes = [...state.nodes];

        if (state.showOnlySelected && state.selectedNodes.length > 0) {
          const selectedSet = new Set(state.selectedNodes);
          const neighbors = new Set<string>();
          
          // 선택된 노드들의 이웃 추가
          state.selectedNodes.forEach(nodeId => {
            state.getNodeNeighbors(nodeId).forEach(neighbor => neighbors.add(neighbor));
          });

          filteredNodes = filteredNodes.filter(node => 
            selectedSet.has(node.id) || neighbors.has(node.id)
          );
        }

        if (state.hideIsolatedNodes) {
          const connectedNodes = new Set<string>();
          state.edges.forEach(edge => {
            connectedNodes.add(edge.source);
            connectedNodes.add(edge.target);
          });
          
          filteredNodes = filteredNodes.filter(node => connectedNodes.has(node.id));
        }

        return filteredNodes;
      },

      getFilteredEdges: () => {
        const state = get();
        const filteredNodes = state.getFilteredNodes();
        const nodeIds = new Set(filteredNodes.map(node => node.id));

        return state.edges.filter(edge => 
          nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );
      },

      getNodeNeighbors: (nodeId) => {
        const state = get();
        const neighbors = new Set<string>();
        
        state.edges.forEach(edge => {
          if (edge.source === nodeId) neighbors.add(edge.target);
          if (edge.target === nodeId) neighbors.add(edge.source);
        });
        
        return Array.from(neighbors);
      }
    }),
    { name: 'graph-store' }
  )
);
```

## 5. 성능 최적화 전략

### 5.1 WebGL 최적화
```typescript
// GPU 기반 인스턴싱
class InstancedRenderer {
  private instanceBuffer: WebGLBuffer;
  private maxInstances: number = 10000;
  
  constructor(private gl: WebGL2RenderingContext) {
    this.instanceBuffer = gl.createBuffer()!;
    this.setupInstanceBuffer();
  }
  
  renderNodes(nodes: GraphNode[]) {
    // 인스턴스 데이터 업데이트 (위치, 크기, 색상)
    const instanceData = new Float32Array(nodes.length * 8); // x,y,z, size, r,g,b,a
    
    nodes.forEach((node, i) => {
      const offset = i * 8;
      instanceData[offset + 0] = node.position.x;
      instanceData[offset + 1] = node.position.y;
      instanceData[offset + 2] = node.position.z;
      instanceData[offset + 3] = node.size;
      instanceData[offset + 4] = node.color[0];
      instanceData[offset + 5] = node.color[1];
      instanceData[offset + 6] = node.color[2];
      instanceData[offset + 7] = node.color[3] || 1.0;
    });
    
    // GPU 버퍼 업데이트
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, instanceData);
    
    // 인스턴스 드로우 콜
    this.gl.drawArraysInstanced(this.gl.TRIANGLE_FAN, 0, 4, nodes.length);
  }
}
```

### 5.2 Level of Detail (LOD)
```typescript
class LODManager {
  calculateLOD(node: GraphNode, camera: CameraController): number {
    const distance = camera.getDistanceToNode(node);
    
    if (distance < 100) return 3; // 고품질
    if (distance < 500) return 2; // 중품질  
    if (distance < 1000) return 1; // 저품질
    return 0; // 렌더링 생략
  }
  
  renderWithLOD(nodes: GraphNode[], camera: CameraController) {
    const lodGroups = {
      high: [] as GraphNode[],
      medium: [] as GraphNode[],
      low: [] as GraphNode[]
    };
    
    nodes.forEach(node => {
      const lod = this.calculateLOD(node, camera);
      if (lod === 3) lodGroups.high.push(node);
      else if (lod === 2) lodGroups.medium.push(node);
      else if (lod === 1) lodGroups.low.push(node);
    });
    
    // LOD별 다른 렌더링 품질
    this.renderHighQuality(lodGroups.high);
    this.renderMediumQuality(lodGroups.medium);  
    this.renderLowQuality(lodGroups.low);
  }
}
```

## 6. 레이아웃 엔진

### 6.1 Force-Directed Layout
```typescript
class ForceDirectedLayout {
  private simulation: d3.Simulation<GraphNode, GraphEdge>;
  
  constructor() {
    this.simulation = d3.forceSimulation<GraphNode>()
      .force('link', d3.forceLink<GraphNode, GraphEdge>().id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(30));
  }
  
  calculateLayout(nodes: GraphNode[], edges: GraphEdge[]): LayoutResult {
    return new Promise((resolve) => {
      this.simulation
        .nodes(nodes)
        .force('link', d3.forceLink(edges).id((d: any) => d.id))
        .on('end', () => {
          resolve({
            nodes: nodes.map(node => ({
              ...node,
              position: { x: node.x || 0, y: node.y || 0, z: 0 }
            })),
            edges
          });
        });
      
      // 시뮬레이션 실행
      this.simulation.alpha(1).restart();
    });
  }
}
```

### 6.2 계층적 레이아웃
```typescript
class HierarchicalLayout {
  calculateLayout(nodes: GraphNode[], edges: GraphEdge[]): LayoutResult {
    // 계층 구조 분석
    const layers = this.analyzeLayers(nodes, edges);
    
    // 레이어별 위치 계산
    const layerHeight = 200;
    const nodeSpacing = 150;
    
    const positionedNodes = nodes.map(node => {
      const layer = layers[node.id];
      const nodesInLayer = Object.keys(layers).filter(id => layers[id] === layer);
      const indexInLayer = nodesInLayer.indexOf(node.id);
      
      return {
        ...node,
        position: {
          x: (indexInLayer - nodesInLayer.length / 2) * nodeSpacing,
          y: layer * layerHeight,
          z: 0
        }
      };
    });
    
    return { nodes: positionedNodes, edges };
  }
  
  private analyzeLayers(nodes: GraphNode[], edges: GraphEdge[]): Record<string, number> {
    // 위상 정렬을 통한 계층 분석
    const layers: Record<string, number> = {};
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    // DFS를 통한 최대 깊이 계산
    const calculateDepth = (nodeId: string): number => {
      if (visited.has(nodeId)) return layers[nodeId];
      if (visiting.has(nodeId)) return 0; // 순환 감지
      
      visiting.add(nodeId);
      
      const incomingEdges = edges.filter(e => e.target === nodeId);
      const maxDepth = incomingEdges.length > 0
        ? Math.max(...incomingEdges.map(e => calculateDepth(e.source) + 1))
        : 0;
      
      visiting.delete(nodeId);
      visited.add(nodeId);
      layers[nodeId] = maxDepth;
      
      return maxDepth;
    };
    
    nodes.forEach(node => calculateDepth(node.id));
    
    return layers;
  }
}
```

## 7. 다음 단계 구현 계획

### Phase 1: 기본 구조 (2주)
1. **React 앱 초기 설정**: Vite + TypeScript + 기본 컴포넌트
2. **WebGL 기본 렌더러**: 간단한 노드/엣지 렌더링
3. **API 클라이언트**: Axios 기반 HTTP 통신
4. **기본 상태 관리**: Zustand 스토어 설정

### Phase 2: 고급 시각화 (2주)
1. **고성능 WebGL 렌더링**: 인스턴싱, LOD, 배치 처리
2. **레이아웃 엔진**: Force-directed, 계층적 레이아웃
3. **상호작용**: 마우스 이벤트, 선택, 줌/팬
4. **검색 시스템**: 실시간 검색, 자동완성

### Phase 3: UI/UX 완성 (2주)  
1. **고급 UI 컴포넌트**: 필터, 설정 패널, 미니맵
2. **테마 시스템**: 다크/라이트 테마
3. **성능 최적화**: 메모리 관리, 렌더링 최적화
4. **접근성**: 키보드 네비게이션, ARIA 지원

총 6주 소요 예상, 점진적 기능 확장 방식으로 개발 예정.