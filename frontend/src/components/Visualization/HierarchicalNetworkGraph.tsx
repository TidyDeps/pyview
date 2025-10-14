import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, Button, Space, message, Slider, Tag, Spin } from 'antd';
import { 
  ReloadOutlined, 
  ExpandOutlined
} from '@ant-design/icons';
import cytoscape from 'cytoscape';

// 확장 라이브러리들 동적 로드
let coseBilkentLoaded = false;

const loadCytoscapeExtensions = async () => {
  if (!coseBilkentLoaded) {
    try {
      // @ts-ignore
      const coseBilkent = await import('cytoscape-cose-bilkent');
      cytoscape.use(coseBilkent.default || coseBilkent);
      coseBilkentLoaded = true;
    } catch (error) {
      // Could not load cytoscape-cose-bilkent
    }
  }
};



interface HierarchicalNode {
  id: string;
  name: string;
  type: 'package' | 'module' | 'class' | 'method' | 'field' | 'function';
  parent?: string;
  children?: string[];
  level: number;
}

interface ClusterContainer {
  id: string;
  type: 'root-container' | 'package-container' | 'module-container' | 'class-container';
  name: string;
  children: string[];
  parentCluster?: string;
}

interface HierarchicalGraphProps {
  data: any;
  cycleData?: any; // 순환 참조 데이터
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  projectName?: string; // 프로젝트 이름
}

const HierarchicalNetworkGraph: React.FC<HierarchicalGraphProps> = ({ 
  data, 
  cycleData,
  onNodeClick,
  selectedNodeId,
  projectName = 'Root' // 기본값 설정
}) => {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<cytoscape.Core | null>(null);
  
  // 상태 관리
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState(1); // 0=package, 1=module, 2=class, 3=method, 4=field
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isLevelChanging, setIsLevelChanging] = useState(false);
  // 고정 모드 설정
  const highlightMode = true; // 하이라이트 모드 고정
  const enableClustering = true; // 클러스터링 고정 설정
  
  // 계층적 노드 구조
  const [hierarchicalData, setHierarchicalData] = useState<{
    nodes: HierarchicalNode[];
    edges: any[];
    hierarchy: Record<string, string[]>;
  }>({ nodes: [], edges: [], hierarchy: {} });
  
  // 순환 참조 정보 처리
  const [cycleInfo, setCycleInfo] = useState<{
    cycleNodes: Set<string>;
    cycleEdges: Set<string>;
  }>({
    cycleNodes: new Set(),
    cycleEdges: new Set()
  });

  // 데이터를 계층적 구조로 변환
  const buildHierarchicalStructure = useCallback((inputData: any) => {
    
    const nodes: HierarchicalNode[] = [];
    const hierarchy: Record<string, string[]> = {};
    const nodesByLevel: Record<number, HierarchicalNode[]> = {};
    
    // 1. 원본 노드들을 계층적 구조로 분류
    if (inputData.nodes) {
      inputData.nodes.forEach((node: any) => {
        const level = getNodeLevel(node.type);
        const hierarchicalNode: HierarchicalNode = {
          id: node.id,
          name: node.name || node.id,
          type: node.type,
          level,
          parent: findParentNode(node, inputData.nodes),
          children: findChildNodes(node, inputData.nodes)
        };
        
        nodes.push(hierarchicalNode);
        
        if (!nodesByLevel[level]) nodesByLevel[level] = [];
        nodesByLevel[level].push(hierarchicalNode);
      });
    }
    
    // 2. 부모-자식 관계 구축
    nodes.forEach(node => {
      if (node.parent) {
        if (!hierarchy[node.parent]) hierarchy[node.parent] = [];
        hierarchy[node.parent].push(node.id);
      }
    });
    
    return {
      nodes,
      edges: inputData.edges || [],
      hierarchy
    };
  }, [viewLevel]);

  // 노드 타입에 따른 레벨 결정
  const getNodeLevel = (type: string): number => {
    switch (type) {
      case 'package': return 0;
      case 'module': return 1;
      case 'class': return 2;
      case 'method': 
      case 'function': return 3;
      case 'field': return 4;
      default: return 1;
    }
  };

  // 부모 노드 찾기 (ID 패턴 기반)
  const findParentNode = (node: any, allNodes: any[]): string | undefined => {
    const nodeId = node.id;
    
    // pkg:core.models -> pkg:core (package -> module)
    // mod:core.models -> pkg:core (module -> package)
    // cls:mod:core.models:User -> mod:core.models (class -> module)
    
    if (nodeId.startsWith('cls:')) {
      const moduleId = nodeId.split(':').slice(0, 2).join(':');
      return allNodes.find(n => n.id === moduleId)?.id;
    } else if (nodeId.startsWith('mod:')) {
      const packageName = nodeId.split(':')[1].split('.')[0];
      const packageId = `pkg:${packageName}`;
      return allNodes.find(n => n.id === packageId)?.id;
    } else if (nodeId.startsWith('meth:') || nodeId.startsWith('field:')) {
      // meth:cls:module_id:class_name:method_name:line_number → cls:module_id:class_name
      const parts = nodeId.split(':');
      if (parts.length >= 4 && parts[1] === 'cls') {
        const classId = `${parts[1]}:${parts[2]}:${parts[3]}`;
        return allNodes.find(n => n.id === classId)?.id;
      }
    }
    
    return undefined;
  };

  // 자식 노드들 찾기
  const findChildNodes = (node: any, allNodes: any[]): string[] => {
    const nodeId = node.id;
    return allNodes
      .filter(n => findParentNode(n, allNodes) === nodeId)
      .map(n => n.id);
  };


  // 현재 표시할 노드들 필터링
  const getVisibleNodes = useCallback(() => {
    // 숨겨야 하는 중복 패키지 전역 필터 적용
    const hiddenPackages: Set<string> = (window as any).__hiddenRootPackages || new Set<string>();

    const visible = hierarchicalData.nodes.filter(node => { 
      if (hiddenPackages.has(node.id)) return false; // 전역적으로 숨김
      // 실노드 필터링
      if (node.level > viewLevel) return false;
      
      // 확장된 노드의 자식들은 표시
      if (node.parent && expandedNodes.has(node.parent)) return true;
      
      // 루트 레벨 노드들은 항상 표시
      return !node.parent || node.level <= viewLevel;
    });
    
    return visible;
  }, [hierarchicalData, viewLevel, expandedNodes]);

  // 데이터 변환
  useEffect(() => {
    if (data) {
      const hierarchical = buildHierarchicalStructure(data);
      setHierarchicalData(hierarchical);
    }
  }, [data, buildHierarchicalStructure]);

  // 순환 참조 데이터 처리
  useEffect(() => {
    if (cycleData && cycleData.cycles) {
      const cycleNodes = new Set<string>();
      const cycleEdges = new Set<string>();

      cycleData.cycles.forEach((cycle: any) => {
        // 순환에 포함된 모든 엔티티 추가
        cycle.entities.forEach((entity: string) => {
          cycleNodes.add(entity);

          // mod: 접두사 제거한 버전도 추가
          if (entity.startsWith('mod:')) {
            const withoutPrefix = entity.substring(4);
            cycleNodes.add(withoutPrefix);
          }

          // 다른 가능한 ID 패턴들도 추가
          if (entity.includes('.')) {
            const parts = entity.split('.');
            const lastPart = parts[parts.length - 1];
            cycleNodes.add(lastPart);
          }
        });

        // 순환 경로의 엣지들 추가
        if (cycle.paths) {
          cycle.paths.forEach((path: any) => {
            // cycle.paths 구조에 따라 처리 방식을 조정
            if (path.from && path.to) {
              // {from: string, to: string} 형태
              const edgeId = `${path.from}-${path.to}`;
              cycleEdges.add(edgeId);
            } else if (path.nodes && Array.isArray(path.nodes)) {
              // {nodes: string[]} 형태
              for (let i = 0; i < path.nodes.length - 1; i++) {
                const edgeId = `${path.nodes[i]}-${path.nodes[i + 1]}`;
                cycleEdges.add(edgeId);
              }
            }
          });
        }
      });

      setCycleInfo({ cycleNodes, cycleEdges });
    } else {
      setCycleInfo({
        cycleNodes: new Set(),
        cycleEdges: new Set()
      });
    }
  }, [cycleData]);

  // Cytoscape 그래프 업데이트
  useEffect(() => {
    if (!cyRef.current || !hierarchicalData.nodes.length) return;

    const initializeCytoscape = async () => {
      try {
        // 확장 라이브러리 로드
        await loadCytoscapeExtensions();
        
        // 기존 인스턴스 정리
        if (cyInstanceRef.current) {
          cyInstanceRef.current.destroy();
        }

      const visibleNodes = getVisibleNodes();
      const elements = transformToElements(visibleNodes, hierarchicalData.edges);
      
      // Cytoscape 인스턴스 생성
      const cy = cytoscape({
        container: cyRef.current,
        elements,
        style: getHierarchicalStylesheet(),
        layout: getHierarchicalLayout(),
        wheelSensitivity: 1,
        minZoom: 0.1,
        maxZoom: 5
      });

      cyInstanceRef.current = cy;

      // 이벤트 핸들러
      setupEventHandlers(cy);

      // 레이아웃 완료 후 자동 맞춤
      cy.ready(() => {
        cy.layout(getHierarchicalLayout()).run();
        setTimeout(() => {
          cy.fit();
          cy.zoom(cy.zoom() * 0.8);
        }, 1000);
      });

      } catch (error) {
        // Error creating hierarchical graph
      }
    };

    initializeCytoscape();

    return () => {
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy();
        cyInstanceRef.current = null;
      }
    };
  }, [hierarchicalData, viewLevel, expandedNodes]);

  // Handle external node selection (from file tree)
  useEffect(() => {
    if (!selectedNodeId) {
      setSelectedNode(null);
      return;
    }

    if (!cyInstanceRef.current) return;
    const cy = cyInstanceRef.current;

    // Update selected node state to show the panel
    setSelectedNode(selectedNodeId);

    // Find and highlight the selected node
    const targetNode = cy.getElementById(selectedNodeId);

    if (targetNode.length > 0) {
      // Use the same highlighting logic as clicking on the graph
      handleHierarchicalHighlight(cy, selectedNodeId);

      // Center the view on the node
      cy.animate({
        center: { eles: targetNode },
        zoom: 1.5
      }, {
        duration: 500
      });

    } else {
      // Try to find node by partial match
      const allNodes = cy.nodes();
      const matchingNode = allNodes.filter(node => {
        const nodeData = node.data();
        return nodeData.id?.includes(selectedNodeId) ||
               nodeData.name?.includes(selectedNodeId) ||
               selectedNodeId?.includes(nodeData.id);
      });

      if (matchingNode.length > 0) {
        const firstMatch = matchingNode.first();
        // Update selectedNode to the actual found node id
        setSelectedNode(firstMatch.id());

        // Use the same highlighting logic as clicking on the graph
        handleHierarchicalHighlight(cy, firstMatch.id());

        cy.animate({
          center: { eles: firstMatch },
          zoom: 1.5
        }, {
          duration: 500
        });
      } else {
        // Keep the selectedNode as is to still show the panel even if not found in graph
      }
    }
  }, [selectedNodeId]);

  // 클러스터링된 요소들을 Cytoscape 형식으로 변환
  const transformToElements = (visibleNodes: HierarchicalNode[], edges: any[]) => {
    if (viewLevel === 0) {
      // 컨테이너(=박스) 만들지 않고, 패키지 노드를 모듈처럼 보이게
      return transformToSimpleElements(visibleNodes, edges);
    }
    if (!enableClustering) return transformToSimpleElements(visibleNodes, edges);
    return buildClusteredLayout(visibleNodes, edges);
  };

  // 기존 방식 (클러스터링 없음)
  const transformToSimpleElements = (visibleNodes: HierarchicalNode[], edges: any[]) => {
    const elements: any[] = [];
    const nodeIds = new Set(visibleNodes.map(n => n.id));

    // 노드 변환
    visibleNodes.forEach(node => {
      const classes = [`node-${node.type}`];
      
      // Pkg 레벨에서 패키지 노드를 모듈처럼 보이게
      if (viewLevel === 0 && node.type === 'package') {
        classes.push('pkg-as-module');
      }
      
      // 순환 참조 클래스 추가
      if (cycleInfo.cycleNodes.has(node.id)) {
        classes.push('in-cycle');
      }
      
      elements.push({
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          level: node.level,
          isInCycle: cycleInfo.cycleNodes.has(node.id)
        },
        classes: classes.join(' ')
      });
    });

    // Level 0(Package 뷰)에서는 중복된 패키지를 전체 렌더링에서 제거하고,
    // root-proxy를 추가한다. 이때 해당 패키지는 이후 레벨에서도 숨김 처리된다.
    if (viewLevel === 0) {
      const duplicatePackageIds = visibleNodes
        .filter(
          n =>
            n.type === 'package' &&
            (n.name === projectName ||
             n.id === `pkg:${projectName}` ||
             n.id === projectName)
        )
        .map(n => n.id);

      if (duplicatePackageIds.length > 0) {
        // 전역 숨김 집합 업데이트
        const winAny = window as any;
        const existing: Set<string> = winAny.__hiddenRootPackages || new Set<string>();
        duplicatePackageIds.forEach((id: string) => existing.add(id));
        winAny.__hiddenRootPackages = existing;

        // 현재 표시 목록 및 elements에서도 제거
        for (const dupId of duplicatePackageIds) {
          const idx = visibleNodes.findIndex(n => n.id === dupId);
          if (idx !== -1) visibleNodes.splice(idx, 1);
          const elIdx = elements.findIndex(el => el.data?.id === dupId);
          if (elIdx !== -1) elements.splice(elIdx, 1);
        }
      }

      // 루트 프록시 노드 추가 (모듈 룩)
      elements.push({
        data: {
          id: 'root-proxy',
          name: projectName,
          type: 'module',
          level: 0
        },
        classes: 'root-as-module'
      });
    }

    // 엣지 변환 (보이는 노드들 간의 연결만, 자기 자신으로의 엣지 제외)
    edges.forEach(edge => {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target) {
        const edgeId = `${edge.source}-${edge.target}`;
        const classes = [];
        
        // 순환 참조 엣지 클래스 추가
        if (cycleInfo.cycleEdges.has(edgeId)) {
          classes.push('cycle-edge');
        }

        // 양방향 또는 참조하는 노드 중 하나라도 순환참조에 포함된 경우도 체크
        const reverseEdgeId = `${edge.target}-${edge.source}`;
        const isSourceInCycle = cycleInfo.cycleNodes.has(edge.source);
        const isTargetInCycle = cycleInfo.cycleNodes.has(edge.target);

        if (cycleInfo.cycleEdges.has(reverseEdgeId) || (isSourceInCycle && isTargetInCycle)) {
          if (!classes.includes('cycle-edge')) {
            classes.push('cycle-edge');
          }
        }
        
        elements.push({
          data: {
            id: edgeId,
            source: edge.source,
            target: edge.target,
            type: edge.type || 'dependency'
          },
          classes: classes.join(' ')
        });
      }
    });

    return elements;
  };

  // 클러스터링 기반 레이아웃 구축
  const buildClusteredLayout = (visibleNodes: HierarchicalNode[], edges: any[]) => {    
    // Step 1: 클러스터 식별
    const clusters = identifyClusters(visibleNodes);    
    
    // Step 2: 컨테이너 노드 생성
    const containerElements = createContainerElements(clusters);

    // Step 3: 노드들에 parent 속성 추가
    const clusteredNodes = assignNodesToContainers(visibleNodes, clusters);

    // Step 4: 엣지 필터링 (자기 자신으로의 엣지 제외)
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    
    const filteredEdges = edges.filter(edge => 
      nodeIds.has(edge.source) && 
      nodeIds.has(edge.target) &&
      edge.source !== edge.target  // 자기 자신으로의 엣지 제외
    ).map(edge => {
      const edgeId = `${edge.source}-${edge.target}`;
      const classes = [];
      
      // 순환 참조 엣지 클래스 추가
      if (cycleInfo.cycleEdges.has(edgeId)) {
        classes.push('cycle-edge');
      }
      
      // 양방향 또는 참조하는 노드 중 하나라도 순환참조에 포함된 경우도 체크
      const reverseEdgeId = `${edge.target}-${edge.source}`;
      const isSourceInCycle = cycleInfo.cycleNodes.has(edge.source);
      const isTargetInCycle = cycleInfo.cycleNodes.has(edge.target);
      
      if (cycleInfo.cycleEdges.has(reverseEdgeId) || (isSourceInCycle && isTargetInCycle)) {
        if (!classes.includes('cycle-edge')) {
          classes.push('cycle-edge');
        }
      }
      
      return {
        data: {
          id: edgeId,
          source: edge.source,
          target: edge.target,
          type: edge.type || 'dependency'
        },
        classes: classes.join(' ')
      };
    });
    
    
    return [...containerElements, ...clusteredNodes, ...filteredEdges];
  };

  // 클러스터 식별
  const identifyClusters = (nodes: HierarchicalNode[]) => {
    const packageClusters = new Map<string, ClusterContainer>();
    const moduleClusters = new Map<string, ClusterContainer>();
    const classClusters = new Map<string, ClusterContainer>();
    
    nodes.forEach(node => {
      // Package 클러스터 식별 (모듈 노드들을 그룹핑)
      if (node.type === 'module') {
        const packageId = extractPackageId(node.id);
        if (!packageClusters.has(packageId)) {
          packageClusters.set(packageId, {
            id: `package-container-${packageId}`,
            type: 'package-container',
            name: `📦 ${packageId}`,
            children: [],
            parentCluster: 'root-container'
          });
        }
        packageClusters.get(packageId)!.children.push(node.id);
      }
      
      // Module 클러스터 식별 (클래스 노드들을 그룹핑)
      if (node.type === 'class') {
        const moduleId = extractModuleId(node.id);
        if (moduleId && !moduleClusters.has(moduleId)) {
          const packageId = extractPackageId(moduleId);
          moduleClusters.set(moduleId, {
            id: `module-container-${moduleId}`,
            type: 'module-container',
            name: `📄 ${moduleId.split(':').pop()?.split('.').pop() || moduleId}`,
            children: [],
            parentCluster: `package-container-${packageId}`
          });
        }
        if (moduleId) {
          moduleClusters.get(moduleId)!.children.push(node.id);
        }
      }
      
      // Class 클러스터 식별 (method/field 노드들을 그룹핑)
      if (node.type === 'method' || node.type === 'field' || node.type === 'function') {
        const classId = extractClassId(node.id);
        if (classId && !classClusters.has(classId)) {
          const moduleId = extractModuleId(classId);
          classClusters.set(classId, {
            id: `class-container-${classId}`,
            type: 'class-container',
            name: `🏷️ ${classId.split(':').pop() || classId}`,
            children: [],
            parentCluster: moduleId ? `module-container-${moduleId}` : undefined
          });
        }
        if (classId) {
          classClusters.get(classId)!.children.push(node.id);
        }
      }
    });
    
    return {
      packages: Array.from(packageClusters.values()),
      modules: Array.from(moduleClusters.values()),
      classes: Array.from(classClusters.values())
    };
  };

  // 패키지 ID 추출
  const extractPackageId = (nodeId: string): string => {
    const parts = nodeId.split(':');
    if (parts.length >= 2) {
      const modulePath = parts[1];
      return modulePath.split('.')[0] || 'unknown';
    }
    return 'unknown';
  };

  // 모듈 ID 추출
  const extractModuleId = (nodeId: string): string | null => {
    const parts = nodeId.split(':');
    if (parts.length >= 3 && parts[0] === 'cls') {
      // 'cls:mod:package.module:ClassName' → 'mod:package.module'
      return `${parts[1]}:${parts[2]}`;
    }
    return null;
  };


  // 클래스 ID 추출 (method/field에서)
  const extractClassId = (nodeId: string): string | null => {
    // PyView 형식: meth:cls:module_id:class_name:method_name:line_number → cls:module_id:class_name
    // PyView 형식: field:cls:module_id:class_name:field_name → cls:module_id:class_name
    if (nodeId.startsWith('meth:') || nodeId.startsWith('field:')) {
      const parts = nodeId.split(':');
      if (parts.length >= 4 && parts[1] === 'cls') {
        return `${parts[1]}:${parts[2]}:${parts[3]}`;
      }
    }
    
    // Demo 데이터 형식: method_cls_ClassName → cls_ClassName
    if (nodeId.includes('_cls_') || nodeId.includes('cls_')) {
      const clsMatch = nodeId.match(/cls_([^_]+)/);
      if (clsMatch) {
        return `cls_${clsMatch[1]}`;
      }
    }
    
    // 직접적인 클래스 참조가 있는 경우
    const parts = nodeId.split('_');
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === 'cls' || parts[i] === 'class') {
        return `cls_${parts[i + 1]}`;
      }
    }
    
    return null;
  };

  // 컨테이너 요소 생성 (타입 없이)
  const createContainerElements = (clusters: { packages: ClusterContainer[], modules: ClusterContainer[], classes: ClusterContainer[] }) => {
    const containerElements: any[] = [];
    
    // 맨 먼저 root-container 요소를 추가
    containerElements.push({
      data: { 
        id: 'root-container', 
        label: viewLevel >= 1 ? `${projectName}` : ''
      },
      classes: viewLevel >= 1 ? 'root-container show-label' : 'root-container'
    });
    
    // 패키지 컨테이너
    clusters.packages.forEach(cluster => {
      if (cluster.children.length > 0) {
        containerElements.push({
          data: {
            id: cluster.id,
            label: cluster.name,
            parent: 'root-container'
          },
          classes: 'package-container'
        });
      }
    });
    
    // 모듈 컨테이너
    clusters.modules.forEach(cluster => {
      if (cluster.children.length > 0) {
        containerElements.push({
          data: {
            id: cluster.id,
            label: cluster.name,
            parent: cluster.parentCluster
          },
          classes: 'module-container'
        });
      }
    });
    
    // 클래스 컨테이너
    clusters.classes.forEach(cluster => {
      if (cluster.children.length > 0) {
        containerElements.push({
          data: {
            id: cluster.id,
            label: cluster.name,
            parent: cluster.parentCluster
          },
          classes: 'class-container'
        });
      }
    });
    
    return containerElements;
  };

  // 노드를 컨테이너에 할당
  const assignNodesToContainers = (nodes: HierarchicalNode[], clusters: { packages: ClusterContainer[], modules: ClusterContainer[], classes: ClusterContainer[] }) => {
    const nodeElements: any[] = [];
    
    nodes.forEach(node => {
      let parentContainer: string | undefined;
      
      // 모듈 노드 → 패키지 컨테이너
      if (node.type === 'module') {
        const packageId = extractPackageId(node.id);
        const packageCluster = clusters.packages.find(c => c.id === `package-container-${packageId}`);
        if (packageCluster && packageCluster.children?.includes(node.id)) {
          parentContainer = packageCluster.id;
        }
      }
      
      // 클래스 노드 → 모듈 컨테이너
      if (node.type === 'class') {
        const moduleId = extractModuleId(node.id);
        if (moduleId) {
          const moduleCluster = clusters.modules.find(c => c.id === `module-container-${moduleId}`);
          if (moduleCluster && moduleCluster.children?.includes(node.id)) {
            parentContainer = moduleCluster.id;
          }
        }
      }
      
      // Method/Field 노드 → 클래스 컨테이너
      if (node.type === 'method' || node.type === 'field' || node.type === 'function') {
        const classId = extractClassId(node.id);
        if (classId) {
          const classCluster = clusters.classes.find(c => c.id === `class-container-${classId}`);
          if (classCluster && classCluster.children?.includes(node.id)) {
            parentContainer = classCluster.id;
          }
        }
      }
      
      const classes = [`node-${node.type}`];
      
      // 순환 참조 클래스 추가
      if (cycleInfo.cycleNodes.has(node.id)) {
        classes.push('in-cycle');
      }
      
      nodeElements.push({
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          level: node.level,
          parent: parentContainer,
          isInCycle: cycleInfo.cycleNodes.has(node.id)
        },
        classes: classes.join(' ')
      });
    });
    
    return nodeElements;
  };



  // 이벤트 핸들러 설정
  const setupEventHandlers = (cy: cytoscape.Core) => {
    // 노드 클릭 (확장/축소)
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData = node.data();
      const nodeId = nodeData.id;
      
      setSelectedNode(nodeId);
      
      // 하이라이트 모드
      if (highlightMode) {
        handleHierarchicalHighlight(cy, nodeId);
      }
      
      // 자식이 있는 노드는 확장/축소
      if (hierarchicalData.hierarchy[nodeId]) {
        toggleNodeExpansion(nodeId);
      }
      
      onNodeClick?.(nodeId);
    });

    // 배경 클릭
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted connected dimmed hierarchical');
        setSelectedNode(null);
      }
    });
  };

  // 노드 확장/축소 토글
  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // 계층적 하이라이트
  const handleHierarchicalHighlight = (cy: cytoscape.Core, nodeId: string) => {
    
    // 먼저 기존 하이라이트 제거
    cy.elements().removeClass('highlighted connected dimmed');

    const targetNode = cy.getElementById(nodeId);
    if (!targetNode.length) {
      return;
    }
    
    const edges = targetNode.connectedEdges();
    const neighbors = edges.connectedNodes();

    // 포커스: 타깃 + 이웃 + 각자의 부모(컨테이너)
    const focus = targetNode
      .union(neighbors)
      .union(targetNode.parents())
      .union(neighbors.parents());

    // 상태 부여
    targetNode.addClass('highlighted');
    neighbors.addClass('connected');
    edges.addClass('highlighted');

    // 포커스 외는 전부 dimmed
    cy.nodes().not(focus).addClass('dimmed');
    cy.edges().not(edges).addClass('dimmed');
  };


  // clearHighlights 함수 제거 - 직접 cy.elements().removeClass() 사용

  // 계층적 스타일시트
  const getHierarchicalStylesheet = (): any[] => [

    // 클래스 노드 전용 스타일 (컨테이너보다 위에 표시)
    {
      selector: 'node[type = "class"]',
      style: {
        'z-index': 100,
        'overlay-opacity': 0,
        'events': 'yes'
      }
    },
    
    // 기본 노드 스타일 (컨테이너보다 위에 표시)
    {
      selector: 'node',
      style: {
        'z-index': 10,
        'background-color': (node: any) => {
          const type = node.data('type') || 'module';
          
          const colors = {
            package: '#B7FF00',
            module: '#52c41a', 
            class: '#fa8c16',
            method: '#eb2f96',
            function: '#eb2f96',
            field: '#722ed1'
          };
          
          return colors[type as keyof typeof colors] || '#d9d9d9';
        },
        'label': (node: any) => {
          const name = node.data('name') || node.data('id') || 'Node';
          return name;
        },
        'font-size': (node: any) => {
          const level = node.data('level') || 1;
          return Math.max(10, 18 - level * 2) + 'px';
        },
        'width': (node: any) => {
          const level = node.data('level') || 1;
          return Math.max(40, 100 - level * 10);
        },
        'height': (node: any) => {
          const level = node.data('level') || 1;
          return Math.max(30, 80 - level * 8);
        },
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#000',
        'text-outline-width': 1,
        'text-outline-color': '#fff',
        'border-width': 2,
        'border-color': '#666',
        'text-wrap': 'wrap', //옵션 : wrap, none, ellipsis
        'text-max-width': '150px',
        'shape': (node: any) => {
          const type = node.data('type') || 'module';
          
          switch (type) {
            case 'package': return 'round-rectangle';
            case 'module': return 'rectangle';
            case 'class': return 'ellipse';
            case 'method': return 'triangle';
            case 'function': return 'triangle';
            case 'field': return 'diamond';
            default: return 'ellipse';
          }
        }
      }
    },
    // 엣지 스타일
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#888',
        'target-arrow-color': '#888',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
      }
    },
    // 루트 타입 전용 스타일 (모듈과 차별화)
    {
      selector: 'node[type = "root"]',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#0050b3',
        'border-color': '#003a8c',
        'border-width': 3,
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#ffffff',
        'text-outline-width': 1,
        'text-outline-color': '#003a8c',
        'font-size': '16px',
        'width': 150,
        'height': 50,
        'z-index': 12
      }
    },
    // Level 0에서 루트를 모듈처럼 보이게 하는 프록시 노드 스타일
    {
      selector: 'node.root-as-module',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#2db7f5',
        'border-color': '#096dd9',
        'border-width': 3,
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#ffffff',
        'text-outline-width': 1,
        'text-outline-color': '#0958d9',
        'font-size': '16px',
        'width': 140,
        'height': 46,
        'z-index': 11
      }
    },
    // root-container 스타일
    {
      selector: '.root-container',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#B0FFB0',
        'background-opacity': 0.05,
        'border-width': 3,
        'border-color': '#8c8c8c',
        'label': '',
        'font-size': '25px',
        'color': '#FFFFFF',
        'text-opacity': 0,
        'z-index': 0,
        'events': 'no'
      }
    },
    // show-label 클래스가 붙은 루트 컨테이너만 라벨 표기
    {
      selector: '.root-container.show-label',
      style: {
        'label': 'data(label)',
        'text-opacity': 1,
        'text-halign': 'left',
        'text-valign': 'top',
        'text-margin-x': 140,
        'text-margin-y': -10,
        'text-font-size': '100px',
        'text-background-opacity': 0.9,
        'text-background-color': '#207000',
        'text-background-padding': 2,
        'text-background-shape': 'round-rectangle'
      }
    },
    // 패키지 컨테이너 스타일
    {
      selector: '.package-container',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#00FF55',
        'background-opacity': 0.08,
        'border-width': 2,
        'border-color': '#52c41a',
        'label': '',
        'text-opacity': 0,
        'padding': '20px',
        'z-index': 1,
        'overlay-opacity': 0,
        'events': 'no'
      }
    },
    // 모듈 컨테이너 스타일
    {
      selector: '.module-container',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#E5FF00',
        'background-opacity': 0.05,
        'border-width': 2,
        'border-color': '#d4b106',
        'label': '',
        'text-opacity': 0,
        'padding': '20px',
        'z-index': 2,
        'overlay-opacity': 0,
        'events': 'no'
      }
    },
    // 클래스 컨테이너 스타일
    {
      selector: '.class-container',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#FF00F2',
        'background-opacity': 0.06,
        'border-width': 2,
        'border-color': '#722ed1',
        'label': '',
        'text-opacity': 0,
        'padding': '20px',
        'z-index': 3,
        'overlay-opacity': 0,
        'events': 'no'
      }
    },
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.3
          }
        },
        // 컨테이너 노드 공통 스타일
        {
          selector: 'node:parent',
          style: {
            'background-opacity': 0.1,
            'text-outline-width': 0
          }
        },

            // 하이라이트 상태들
    {
      selector: 'node.highlighted',
      style: {
        'border-color': '#1E90FF',
        'opacity': 1,
        'border-width': 5,
        'z-index': 999
      }
    },
    {
      selector: 'node.connected',
      style: {
        'border-color': '#FF5100',
        'border-width': 4,
        'opacity': 1
      }
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#1E90FF',
        'target-arrow-color': '#1E90FF',
        'width': 4
      }
    },
    
    // 순환 참조 엣지 스타일 - 기본
    {
      selector: 'edge.cycle-edge',
      style: {
        'line-color': '#ff4d4f',
        'target-arrow-color': '#ff4d4f',
        'source-arrow-color': '#ff4d4f',
        'width': 4,
        'line-style': 'solid',
        'opacity': 1,
        'curve-style': 'bezier',
        'z-index': 50,
        'arrow-scale': 1.5
      }
    },
    {
      selector: 'edge.dimmed',
      style: {
        'opacity': 0.3
      }
    },
  ];

  // 계층적 레이아웃 - Cose-Bilkent만 사용
  const getHierarchicalLayout = () => {
    return {
      name: 'cose-bilkent',
      quality: 'default',
      nodeDimensionsIncludeLabels: true,
      refresh: 20,
      fit: true,
      padding: 30,
      randomize: false,
      nodeRepulsion: 6000,
      idealEdgeLength: 70,
      edgeElasticity: 0.45,
      nestingFactor: 0.2,
      gravity: 0.25,
      numIter: 2500,
      tile: true,
      tilingPaddingVertical: 40,
      tilingPaddingHorizontal: 40,
      animate: false
    };
  };

  // 레벨 변경 핸들러
  const handleLevelChange = async (newLevel: number) => {
    setIsLevelChanging(true);
    message.loading(`${getLevelName(newLevel)} 레벨로 전환 중...`, 0.5);
    
    // Give UI time to show loading state
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setViewLevel(newLevel);
    setExpandedNodes(new Set()); // 레벨 변경 시 확장 상태 초기화
    
    // Additional delay to prevent UI freezing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    setIsLevelChanging(false);
    message.success(`현재 ${getLevelName(newLevel)} 레벨을 보고 있습니다`);
  };

  const getLevelName = (level: number): string => {
    const names = ['Package', 'Module', 'Class', 'Method', 'Field'];
    return names[level] || 'Unknown';
  };

  // 전체 확장/축소
  const expandAll = () => {
    const allExpandableNodes = hierarchicalData.nodes
      .filter(n => n.children && n.children.length > 0)
      .map(n => n.id);
    setExpandedNodes(new Set(allExpandableNodes));
    message.success('모든 노드가 초기화되었습니다');
  };



  return (
    <div style={{ width: '100%', height: '85vh', display: 'flex', flexDirection: 'column' }}>
      {/* 컨트롤 패널 - 상단 고정 */}
      <Card 
        size="small" 
        title="계층 컨트롤"
        style={{ 
          marginBottom: 16,
          minWidth: '100%'
        }}
      >
        {/* 컨트롤 패널을 3분할로 구성 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 16 }}>
          {/* 왼쪽: View Level 컨트롤 */}
          <div style={{ flex: '0 0 280px' }}>
            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
              Level: <Tag color="blue">{getLevelName(viewLevel)}</Tag>
            </div>
            <Slider
              min={0}
              max={4}
              value={viewLevel}
              onChange={handleLevelChange}
              marks={{
                0: 'Pkg',
                1: 'Mod',
                2: 'Cls',
                3: 'Mth',
                4: 'Fld'
              }}
              style={{ width: '100%' }}
            />
          </div>

          {/* 가운데: 기타 컨트롤들 */}
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
            <Space wrap>
              
              <Button size="small" onClick={expandAll} icon={<ReloadOutlined />}>
초기화
              </Button>

              <Button 
                size="small" 
                onClick={() => cyInstanceRef.current?.fit()}
                icon={<ExpandOutlined />}
              >
배율 초기화
              </Button>
            </Space>
          </div>

          {/* 오른쪽: Selected Node 정보 (간략화) */}
          <div style={{ flex: '1', minWidth: 0 }}>
            {selectedNode && (() => {
              const nodeInfo = hierarchicalData.nodes.find(n => n.id === selectedNode);
              const nodeEdges = hierarchicalData.edges.filter(e => 
                e.source === selectedNode || e.target === selectedNode
              );
              const incoming = nodeEdges.filter(e => e.target === selectedNode);
              const outgoing = nodeEdges.filter(e => e.source === selectedNode);
              
              return (
                <div style={{ 
                  padding: 10, 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  height: 'fit-content'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#1890ff' }}>
선택된 노드
                  </div>
                  
                  {nodeInfo ? (
                    <div style={{ fontSize: 12, lineHeight: 1.3, display: 'flex', gap: 12 }}>
                      {/* 왼쪽: 기본 정보 */}
                      <div style={{ flex: '0 0 auto' }}>
                        <div><strong>이름:</strong> {nodeInfo.name}</div>
                        <br></br>
                        <div><strong>타입:</strong> 
                          <Tag color={
                            nodeInfo.type === 'package' ? 'green' :
                            nodeInfo.type === 'module' ? 'blue' :
                            nodeInfo.type === 'class' ? 'orange' :
                            nodeInfo.type === 'method' ? 'purple' :
                            nodeInfo.type === 'field' ? 'cyan' : 'default'
                          } style={{ marginLeft: 4, fontSize: 10 }}>
                            {nodeInfo.type.toUpperCase()}
                          </Tag>
                        </div>
                      </div>
                      
                      {/* 오른쪽: 연결된 노드 정보 */}
                      {(incoming.length > 0 || outgoing.length > 0) && (
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 8, borderLeft: '1px solid #e0e0e0' }}>
                          {incoming.length > 0 && (
                            <div style={{ marginBottom: 2 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#52c41a' }}>← In ({incoming.length}):</div>
                              <div style={{ fontSize: 10, color: '#666' }}>
                                {incoming.slice(0, 2).map((e, idx) => {
                                  const sourceName = hierarchicalData.nodes.find(n => n.id === e.source)?.name || e.source;
                                  return <span key={idx}>{sourceName}{idx < incoming.slice(0, 2).length - 1 ? ', ' : ''}</span>;
                                })}
                                {incoming.length > 2 && <span>... +{incoming.length - 2}</span>}
                              </div>
                            </div>
                          )}
                          
                          {outgoing.length > 0 && (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#1890ff' }}>→ Out ({outgoing.length}):</div>
                              <div style={{ fontSize: 10, color: '#666' }}>
                                {outgoing.slice(0, 2).map((e, idx) => {
                                  const targetName = hierarchicalData.nodes.find(n => n.id === e.target)?.name || e.target;
                                  return <span key={idx}>{targetName}{idx < outgoing.slice(0, 2).length - 1 ? ', ' : ''}</span>;
                                })}
                                {outgoing.length > 2 && <span>... +{outgoing.length - 2}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {nodeInfo.children && nodeInfo.children.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>
                          👶 Children: {nodeInfo.children.length}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#999' }}>
선택된 노드 없음
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </Card>



      {/* Cytoscape 컨테이너 */}
      <div 
        style={{ 
          position: 'relative',
          width: '100%', 
          flex: 1
        }}
      >
        <div 
          ref={cyRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            backgroundColor: '#fafafa',
            border: '1px solid var(--ant-color-border)',
            borderRadius: 6
          }} 
        />
        
        {/* Level Changing Loading Overlay */}
        {isLevelChanging && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: 6
          }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, fontSize: 16, fontWeight: 500 }}>
{getLevelName(viewLevel)} 레벨 렌더링 중...
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
더 나은 성능을 위해 레이아웃 최적화 중
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HierarchicalNetworkGraph;
