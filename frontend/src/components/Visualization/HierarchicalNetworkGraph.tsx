import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, Button, Space, message, Slider, Tag, Spin } from 'antd';
import { 
  ReloadOutlined, 
  ExpandOutlined
} from '@ant-design/icons';
import cytoscape from 'cytoscape';

// 확장 라이브러리들 동적 로드
let coseBilkentLoaded = false;
let colaLoaded = false;

const loadCytoscapeExtensions = async () => {
  if (!coseBilkentLoaded) {
    try {
      // @ts-ignore
      const coseBilkent = await import('cytoscape-cose-bilkent');
      cytoscape.use(coseBilkent.default || coseBilkent);
      coseBilkentLoaded = true;
      console.log('✅ Loaded cytoscape-cose-bilkent');
    } catch (error) {
      console.warn('Could not load cytoscape-cose-bilkent:', error);
    }
  }
  
  if (!colaLoaded) {
    try {
      // @ts-ignore
      const cola = await import('cytoscape-cola');
      cytoscape.use(cola.default || cola);
      colaLoaded = true;
      console.log('✅ Loaded cytoscape-cola');
    } catch (error) {
      console.warn('Could not load cytoscape-cola:', error);
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
  isExpanded: boolean;
  isSuperNode: boolean;
  childCount?: number;
  aggregatedData?: {
    totalChildren: number;
    childTypes: Record<string, number>;
  };
}

interface ClusterContainer {
  id: string;
  type: 'package-cluster' | 'module-cluster' | 'class-cluster';
  name: string;
  children: string[];
  bounds?: { x: number, y: number, width: number, height: number };
  parentCluster?: string;
}

// interface ClusteredLayoutData {
//   containers: ClusterContainer[];
//   nodes: HierarchicalNode[];
//   edges: any[];
// }

interface HierarchicalGraphProps {
  data: any;
  cycleData?: any; // 순환 참조 데이터
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

const HierarchicalNetworkGraph: React.FC<HierarchicalGraphProps> = ({ 
  data, 
  cycleData,
  onNodeClick,
  selectedNodeId 
}) => {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<cytoscape.Core | null>(null);
  
  // 상태 관리
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const layoutType = 'clustered'; // 레이아웃 고정 설정
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
    nodeSeverity: Map<string, string>;
    edgeSeverity: Map<string, string>;
  }>({ 
    cycleNodes: new Set(), 
    cycleEdges: new Set(), 
    nodeSeverity: new Map(), 
    edgeSeverity: new Map() 
  });

  // 데이터를 계층적 구조로 변환
  const buildHierarchicalStructure = useCallback((inputData: any) => {
    console.log('🏗️ Building hierarchical structure from:', inputData);
    
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
          isExpanded: level <= viewLevel,
          isSuperNode: false,
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
    
    // 3. SuperNode 생성 (집계된 노드들)
    const superNodes = createSuperNodes(nodesByLevel, viewLevel);
    
    return {
      nodes: [...nodes, ...superNodes],
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

  // SuperNode 생성 (현재 레벨보다 깊은 노드들을 집계)
  const createSuperNodes = (nodesByLevel: Record<number, HierarchicalNode[]>, currentLevel: number): HierarchicalNode[] => {
    const superNodes: HierarchicalNode[] = [];
    
    // 현재 레벨보다 깊은 레벨의 노드들을 부모별로 그룹화
    for (let level = currentLevel + 1; level <= 4; level++) {
      const nodesAtLevel = nodesByLevel[level] || [];
      const groupedByParent = nodesAtLevel.reduce((acc, node) => {
        const parent = node.parent || 'root';
        if (!acc[parent]) acc[parent] = [];
        acc[parent].push(node);
        return acc;
      }, {} as Record<string, HierarchicalNode[]>);
      
      // 각 부모에 대해 SuperNode 생성
      Object.entries(groupedByParent).forEach(([parentId, children]) => {
        if (children.length > 1) {
          const childTypes = children.reduce((acc, child) => {
            acc[child.type] = (acc[child.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const superNode: HierarchicalNode = {
            id: `super:${parentId}:level${level}`,
            name: `${children.length} ${children[0].type}s`,
            type: children[0].type,
            level: currentLevel + 0.5, // 중간 레벨
            isExpanded: false,
            isSuperNode: true,
            parent: parentId,
            children: children.map(c => c.id),
            childCount: children.length,
            aggregatedData: {
              totalChildren: children.length,
              childTypes
            }
          };
          
          superNodes.push(superNode);
        }
      });
    }
    
    return superNodes;
  };

  // 현재 표시할 노드들 필터링
  const getVisibleNodes = useCallback(() => {
    const visible = hierarchicalData.nodes.filter(node => {
      // 현재 레벨 이하의 노드들만 표시
      if (node.level > viewLevel && !node.isSuperNode) return false;
      
      // SuperNode는 현재 레벨에서 표시
      if (node.isSuperNode) return true;
      
      // 확장된 노드의 자식들은 표시
      if (node.parent && expandedNodes.has(node.parent)) return true;
      
      // 루트 레벨 노드들은 항상 표시
      return !node.parent || node.level <= viewLevel;
    });
    
    console.log(`👁️ Visible nodes at level ${viewLevel}:`, visible.length);
    return visible;
  }, [hierarchicalData, viewLevel, expandedNodes]);

  // 데이터 변환
  useEffect(() => {
    if (data) {
      const hierarchical = buildHierarchicalStructure(data);
      setHierarchicalData(hierarchical);
      console.log('🏗️ Hierarchical data built:', hierarchical);
    }
  }, [data, buildHierarchicalStructure]);

  // 순환 참조 데이터 처리
  useEffect(() => {
    console.log('🔄 HierarchicalNetworkGraph received cycleData:', cycleData);
    
    if (cycleData && cycleData.cycles) {
      const cycleNodes = new Set<string>();
      const cycleEdges = new Set<string>();
      const nodeSeverity = new Map<string, string>();
      const edgeSeverity = new Map<string, string>();

      console.log('🔄 Processing cycles:', cycleData.cycles);

      cycleData.cycles.forEach((cycle: any, index: number) => {
        const severity = cycle.severity || 'medium';
        console.log(`🔄 Processing cycle ${index + 1}:`, {
          id: cycle.id,
          entities: cycle.entities,
          severity: severity,
          cycle_type: cycle.cycle_type
        });
        
        // 순환에 포함된 모든 엔티티 추가
        cycle.entities.forEach((entity: string) => {
          cycleNodes.add(entity);
          nodeSeverity.set(entity, severity);
          console.log(`🔄 Added cycle node: ${entity} (severity: ${severity})`);
          
          // mod: 접두사 제거한 버전도 추가
          if (entity.startsWith('mod:')) {
            const withoutPrefix = entity.substring(4);
            cycleNodes.add(withoutPrefix);
            nodeSeverity.set(withoutPrefix, severity);
            console.log(`🔄 Also added without mod prefix: ${withoutPrefix}`);
          }
          
          // 다른 가능한 ID 패턴들도 추가
          if (entity.includes('.')) {
            const parts = entity.split('.');
            const lastPart = parts[parts.length - 1];
            cycleNodes.add(lastPart);
            nodeSeverity.set(lastPart, severity);
            console.log(`🔄 Also added last part: ${lastPart}`);
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
              edgeSeverity.set(edgeId, severity);
            } else if (path.nodes && Array.isArray(path.nodes)) {
              // {nodes: string[]} 형태
              for (let i = 0; i < path.nodes.length - 1; i++) {
                const edgeId = `${path.nodes[i]}-${path.nodes[i + 1]}`;
                cycleEdges.add(edgeId);
                edgeSeverity.set(edgeId, severity);
              }
            }
          });
        }
      });

      setCycleInfo({ cycleNodes, cycleEdges, nodeSeverity, edgeSeverity });
      console.log('🔄 Cycle info processed:', { 
        cycleNodes: Array.from(cycleNodes),
        totalNodes: cycleNodes.size, 
        totalEdges: cycleEdges.size 
      });
      
      // 실제 그래프 노드 ID와 비교를 위한 디버깅
      if (data && data.nodes) {
        console.log('🔍 Graph node IDs (first 20):', data.nodes.slice(0, 20).map((n: any) => n.id));
        console.log('🔍 All cycle nodes:', Array.from(cycleNodes));
        
        // 실제 매칭 테스트
        const moduleNodes = data.nodes.filter((n: any) => n.type === 'module');
        console.log('🔍 Module nodes in graph:');
        moduleNodes.forEach((node: any) => {
          const isInCycle = cycleNodes.has(node.id);
          console.log(`  - ${node.id} (${node.name}) -> in cycle: ${isInCycle ? '✅' : '❌'}`);
        });
      }
    } else {
      console.log('🔄 No cycle data received or cycles is empty');
      setCycleInfo({ 
        cycleNodes: new Set(), 
        cycleEdges: new Set(), 
        nodeSeverity: new Map(), 
        edgeSeverity: new Map() 
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
      
      console.log('🎨 Creating Cytoscape with elements:', elements.length);
      
      // Cytoscape 인스턴스 생성
      const cy = cytoscape({
        container: cyRef.current,
        elements,
        style: getHierarchicalStylesheet(),
        layout: getHierarchicalLayout(layoutType),
        wheelSensitivity: 1,
        minZoom: 0.1,
        maxZoom: 5
      });

      cyInstanceRef.current = cy;

      // 이벤트 핸들러
      setupEventHandlers(cy);

      // 레이아웃 완료 후 자동 맞춤
      cy.ready(() => {
        cy.layout(getHierarchicalLayout(layoutType)).run();
        setTimeout(() => {
          cy.fit();
          cy.zoom(cy.zoom() * 0.8);
        }, 1000);
      });

      } catch (error) {
        console.error('Error creating hierarchical graph:', error);
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
    if (!cyInstanceRef.current || !selectedNodeId) return;
    const cy = cyInstanceRef.current;
    
    // Clear previous highlights
    cy.elements().removeClass('highlighted connected dimmed hierarchical');
    
    // Find and highlight the selected node
    const targetNode = cy.getElementById(selectedNodeId);
    
    if (targetNode.length > 0) {
      // Highlight the node
      targetNode.addClass('highlighted');
      
      // Center the view on the node
      cy.animate({
        center: { eles: targetNode },
        zoom: 1.5
      }, {
        duration: 500
      });
      
      console.log('HierarchicalNetworkGraph - Centered on node:', selectedNodeId);
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
        firstMatch.addClass('highlighted');
        
        cy.animate({
          center: { eles: firstMatch },
          zoom: 1.5
        }, {
          duration: 500
        });
        console.log('HierarchicalNetworkGraph - Centered on matching node:', firstMatch.id());
      } else {
        console.warn('HierarchicalNetworkGraph - Node not found:', selectedNodeId);
      }
    }
  }, [selectedNodeId]);

  // 클러스터링된 요소들을 Cytoscape 형식으로 변환
  const transformToElements = (visibleNodes: HierarchicalNode[], edges: any[]) => {
    if (!enableClustering) {
      return transformToSimpleElements(visibleNodes, edges);
    }
    
    return buildClusteredLayout(visibleNodes, edges);
  };

  // 기존 방식 (클러스터링 없음)
  const transformToSimpleElements = (visibleNodes: HierarchicalNode[], edges: any[]) => {
    const elements: any[] = [];
    const nodeIds = new Set(visibleNodes.map(n => n.id));

    // 노드 변환
    visibleNodes.forEach(node => {
      const classes = [`node-${node.type}`];
      
      // 순환 참조 클래스 추가
      if (cycleInfo.cycleNodes.has(node.id)) {
        classes.push('in-cycle');
        const severity = cycleInfo.nodeSeverity.get(node.id);
        if (severity) {
          classes.push(`cycle-${severity}`);
        }
      }
      
      elements.push({
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          level: node.level,
          isSuperNode: node.isSuperNode,
          isExpanded: node.isExpanded,
          childCount: node.childCount,
          isInCycle: cycleInfo.cycleNodes.has(node.id)
        },
        classes: classes.join(' ')
      });
    });

    // 엣지 변환 (보이는 노드들 간의 연결만, 자기 자신으로의 엣지 제외)
    edges.forEach(edge => {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target) {
        const edgeId = `${edge.source}-${edge.target}`;
        const classes = [];
        
        // 순환 참조 엣지 클래스 추가
        if (cycleInfo.cycleEdges.has(edgeId)) {
          classes.push('cycle-edge');
          const severity = cycleInfo.edgeSeverity.get(edgeId);
          if (severity) {
            classes.push(`cycle-${severity}`);
          }
        }
        
        // 양방향 또는 참조하는 노드 중 하나라도 순환참조에 포함된 경우도 체크
        const reverseEdgeId = `${edge.target}-${edge.source}`;
        const isSourceInCycle = cycleInfo.cycleNodes.has(edge.source);
        const isTargetInCycle = cycleInfo.cycleNodes.has(edge.target);
        
        if (cycleInfo.cycleEdges.has(reverseEdgeId) || (isSourceInCycle && isTargetInCycle)) {
          if (!classes.includes('cycle-edge')) {
            classes.push('cycle-edge');
          }
          if (!classes.some(c => c.startsWith('cycle-'))) {
            // 소스나 타겟의 심각도 중 높은 것 사용
            const sourceSeverity = cycleInfo.nodeSeverity.get(edge.source);
            const targetSeverity = cycleInfo.nodeSeverity.get(edge.target);
            const severity = sourceSeverity === 'high' || targetSeverity === 'high' ? 'high' :
                           sourceSeverity === 'medium' || targetSeverity === 'medium' ? 'medium' : 'low';
            classes.push(`cycle-${severity}`);
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
    console.log('🎯 Building clustered layout...');
    
    // Step 1: 클러스터 식별
    const clusters = identifyClusters(visibleNodes);
    console.log('📦 Identified clusters:', clusters);
    
    // Step 2: 컨테이너 노드 생성
    const containerElements = createContainerElements(clusters);
    
    // Step 3: 노드들에 parent 속성 추가
    const clusteredNodes = assignNodesToContainers(visibleNodes, clusters);
    
    // Step 4: 엣지 필터링 (자기 자신으로의 엣지 제외)
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    console.log('🔗 Processing edges for clustering:', {
      totalEdges: edges.length,
      nodeIds: Array.from(nodeIds).slice(0, 5),
      sampleEdges: edges.slice(0, 5)
    });
    
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
        const severity = cycleInfo.edgeSeverity.get(edgeId);
        if (severity) {
          classes.push(`cycle-${severity}`);
        }
      }
      
      // 양방향 또는 참조하는 노드 중 하나라도 순환참조에 포함된 경우도 체크
      const reverseEdgeId = `${edge.target}-${edge.source}`;
      const isSourceInCycle = cycleInfo.cycleNodes.has(edge.source);
      const isTargetInCycle = cycleInfo.cycleNodes.has(edge.target);
      
      if (cycleInfo.cycleEdges.has(reverseEdgeId) || (isSourceInCycle && isTargetInCycle)) {
        if (!classes.includes('cycle-edge')) {
          classes.push('cycle-edge');
        }
        if (!classes.some(c => c.startsWith('cycle-'))) {
          // 소스나 타겟의 심각도 중 높은 것 사용
          const sourceSeverity = cycleInfo.nodeSeverity.get(edge.source);
          const targetSeverity = cycleInfo.nodeSeverity.get(edge.target);
          const severity = sourceSeverity === 'high' || targetSeverity === 'high' ? 'high' :
                         sourceSeverity === 'medium' || targetSeverity === 'medium' ? 'medium' : 'low';
          classes.push(`cycle-${severity}`);
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
    
    console.log('✅ Filtered edges for clustering:', {
      filteredCount: filteredEdges.length,
      sampleFiltered: filteredEdges.slice(0, 3)
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
            id: `package-cluster-${packageId}`,
            type: 'package-cluster',
            name: `📦 ${packageId}`,
            children: []
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
            id: `module-cluster-${moduleId}`,
            type: 'module-cluster',
            name: `📄 ${moduleId.split(':').pop()?.split('.').pop() || moduleId}`,
            children: [],
            parentCluster: `package-cluster-${packageId}`
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
            id: `class-cluster-${classId}`,
            type: 'class-cluster',
            name: `🏷️ ${classId.split(':').pop() || classId}`,
            children: [],
            parentCluster: moduleId ? `module-cluster-${moduleId}` : undefined
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

  // 컨테이너 요소 생성  
  const createContainerElements = (clusters: { packages: ClusterContainer[], modules: ClusterContainer[], classes: ClusterContainer[] }) => {
    const containerElements: any[] = [];
    
    // 패키지 컨테이너
    clusters.packages.forEach(cluster => {
      if (cluster.children.length > 0) {
        containerElements.push({
          data: {
            id: cluster.id,
            label: cluster.name,
            type: 'package-container'
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
            type: 'module-container',
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
            type: 'class-container',
            parent: cluster.parentCluster
          },
          classes: 'class-container'
        });
      }
    });
    
    console.log('📦 Created container elements:', containerElements.length);
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
        const packageCluster = clusters.packages.find(c => c.id === `package-cluster-${packageId}`);
        if (packageCluster && packageCluster.children?.includes(node.id)) {
          parentContainer = packageCluster.id;
        }
      }
      
      // 클래스 노드 → 모듈 컨테이너
      if (node.type === 'class') {
        const moduleId = extractModuleId(node.id);
        if (moduleId) {
          const moduleCluster = clusters.modules.find(c => c.id === `module-cluster-${moduleId}`);
          if (moduleCluster && moduleCluster.children?.includes(node.id)) {
            parentContainer = moduleCluster.id;
          }
        }
      }
      
      // Method/Field 노드 → 클래스 컨테이너
      if (node.type === 'method' || node.type === 'field' || node.type === 'function') {
        const classId = extractClassId(node.id);
        if (classId) {
          const classCluster = clusters.classes.find(c => c.id === `class-cluster-${classId}`);
          if (classCluster && classCluster.children?.includes(node.id)) {
            parentContainer = classCluster.id;
          }
        }
      }
      
      const classes = [`node-${node.type}`];
      
      // 순환 참조 클래스 추가
      if (cycleInfo.cycleNodes.has(node.id)) {
        classes.push('in-cycle');
        const severity = cycleInfo.nodeSeverity.get(node.id);
        if (severity) {
          classes.push(`cycle-${severity}`);
        }
      }
      
      nodeElements.push({
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          level: node.level,
          isSuperNode: node.isSuperNode,
          isExpanded: node.isExpanded,
          childCount: node.childCount,
          parent: parentContainer,
          isInCycle: cycleInfo.cycleNodes.has(node.id)
        },
        classes: classes.join(' ')
      });
    });
    
    console.log('🔗 Assigned nodes to containers:', nodeElements.length);
    return nodeElements;
  };



  // 이벤트 핸들러 설정
  const setupEventHandlers = (cy: cytoscape.Core) => {
    // 노드 클릭 (확장/축소)
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData = node.data();
      const nodeId = nodeData.id;
      
      console.log('🎯 Node clicked:', { nodeId, nodeData, type: nodeData.type });
      setSelectedNode(nodeId);
      
      // 하이라이트 모드 (컨테이너가 아닌 모든 실제 노드에 적용)
      if (highlightMode && nodeData.type !== 'package-container' && nodeData.type !== 'module-container' && nodeData.type !== 'class-container') {
        console.log('🌟 Applying highlight to:', nodeId, 'type:', nodeData.type);
        handleHierarchicalHighlight(cy, nodeId);
      }
      
      // SuperNode이거나 자식이 있는 노드는 확장/축소
      if (nodeData.isSuperNode || hierarchicalData.hierarchy[nodeId]) {
        toggleNodeExpansion(nodeId);
      }
      
      onNodeClick?.(nodeId);
      
      const action = expandedNodes.has(nodeId) ? 'Collapsed' : 'Expanded';
      message.info(`${action}: ${nodeData.name || nodeId}`);
    });

    // 배경 클릭
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        console.log('🌍 Background clicked - clearing highlights');
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
    console.log('🔍 Starting highlight for:', nodeId);
    
    // 먼저 기존 하이라이트 제거
    cy.elements().removeClass('highlighted connected dimmed hierarchical');

    const targetNode = cy.getElementById(nodeId);
    if (!targetNode.length) {
      console.warn('❌ Target node not found:', nodeId);
      return;
    }

    console.log('✅ Target node found:', targetNode.data());
    const connectedEdges = targetNode.connectedEdges();
    const connectedNodes = connectedEdges.connectedNodes();

    // 계층적 관계 하이라이트
    const relatedNodes = getHierarchicallyRelatedNodes(cy, nodeId);
    
    console.log('🔗 Connected nodes:', connectedNodes.length);
    console.log('👥 Related nodes:', relatedNodes.length);
    
    // 약간의 지연을 주어 하이라이트가 제대로 적용되도록 함
    setTimeout(() => {
      // 클릭한 노드 하이라이트 (가장 중요!)
      targetNode.addClass('highlighted');
      console.log('🎯 Target highlighted:', targetNode.data('type'), targetNode.data('id'));
      
      // 연결된 노드들 하이라이트 (컨테이너 제외)
      const actualConnectedNodes = connectedNodes.filter(node => {
        const nodeType = node.data('type');
        return nodeType !== 'package-container' && nodeType !== 'module-container' && nodeType !== 'class-container';
      });
      actualConnectedNodes.addClass('connected');
      
      // 관련 노드들 하이라이트 (컨테이너 제외)
      const actualRelatedNodes = relatedNodes.filter(node => {
        const nodeType = node.data('type');
        return nodeType !== 'package-container' && nodeType !== 'module-container' && nodeType !== 'class-container';
      });
      actualRelatedNodes.addClass('hierarchical');
      
      connectedEdges.addClass('highlighted');
      
      // 나머지 흐리게 (컨테이너는 dimmed에서 제외)
      const nonContainerNodes = cy.nodes().filter(node => {
        const nodeType = node.data('type');
        return nodeType !== 'package-container' && nodeType !== 'module-container' && nodeType !== 'class-container';
      });
      
      nonContainerNodes.not(targetNode).not(actualConnectedNodes).not(actualRelatedNodes).addClass('dimmed');
      cy.edges().not(connectedEdges).addClass('dimmed');
      
      console.log('🎨 Highlight applied successfully - target should be highlighted now');
    }, 50);
  };

  // 계층적으로 관련된 노드들 찾기
  const getHierarchicallyRelatedNodes = (cy: cytoscape.Core, nodeId: string): cytoscape.NodeCollection => {
    console.log('🔎 Finding related nodes for:', nodeId);
    
    const node = hierarchicalData.nodes.find(n => n.id === nodeId);
    if (!node) {
      console.warn('❌ Node not found in hierarchical data:', nodeId);
      return cy.collection();
    }

    console.log('📊 Node data:', { id: node.id, type: node.type, parent: node.parent, children: node.children });

    let relatedIds: string[] = [];
    
    // 부모 노드
    if (node.parent) {
      relatedIds.push(node.parent);
      console.log('👆 Parent found:', node.parent);
    }
    
    // 자식 노드들
    if (node.children && node.children.length > 0) {
      relatedIds.push(...node.children);
      console.log('👇 Children found:', node.children);
    }
    
    // 형제 노드들 (같은 부모를 가진 노드들)
    if (node.parent) {
      const siblings = hierarchicalData.nodes
        .filter(n => n.parent === node.parent && n.id !== nodeId)
        .map(n => n.id);
      relatedIds.push(...siblings);
      console.log('👫 Siblings found:', siblings);
    }

    // 같은 타입 노드 하이라이트 기능 제거 - 실제 연결된 노드만 하이라이트
    // (이전에 클래스 클릭 시 다른 클래스들도 하이라이트되던 기능을 제거함)

    console.log('🎯 Total related IDs:', relatedIds);
    const relatedNodes = cy.nodes().filter(n => relatedIds.includes(n.id()));
    console.log('✅ Related nodes found in cytoscape:', relatedNodes.length);
    
    return relatedNodes;
  };

  // clearHighlights 함수 제거 - 직접 cy.elements().removeClass() 사용

  // 계층적 스타일시트
  const getHierarchicalStylesheet = (): any[] => [
    // 패키지 컨테이너 스타일
    {
      selector: '.package-container',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#fff7e6',
        'background-opacity': 0.05,
        'border-width': 3,
        'border-style': 'dashed',
        'border-color': '#d4b106',
        'border-opacity': 0.8,
        'content': '',  // 클러스터 라벨 숨김
        'text-opacity': 0,  // 텍스트 완전 숨김
        'padding': '39px',
        'width': 300,
        'height': 200,
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
        'background-color': '#f9f0ff',
        'background-opacity': 0.08,
        'border-width': 2,
        'border-style': 'dashed',
        'border-color': '#722ed1',
        'border-opacity': 0.7,
        'content': '',  // 클러스터 라벨 숨김
        'text-opacity': 0,  // 텍스트 완전 숨김
        'padding': '30px',
        'width': 220,
        'height': 140,
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
        'background-color': '#f0f9ff',
        'background-opacity': 0.06,
        'border-width': 1,
        'border-style': 'dotted',
        'border-color': '#1890ff',
        'border-opacity': 0.6,
        'content': '',  // 클러스터 라벨 숨김
        'text-opacity': 0,  // 텍스트 완전 숨김
        'padding': '21px',
        'width': 150,
        'height': 100,
        'z-index': 3,
        'overlay-opacity': 0,
        'events': 'no'
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
    // 클래스 노드 전용 스타일 (컨테이너보다 위에 표시)
    {
      selector: 'node[type="class"]',
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
          const isSuperNode = node.data('isSuperNode') || false;
          
          if (isSuperNode) return '#d9d9d9';
          
          const colors = {
            package: '#1890ff',
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
          const isSuperNode = node.data('isSuperNode') || false;
          const childCount = node.data('childCount');
          
          if (isSuperNode && childCount) {
            return `${name} (${childCount})`;
          }
          
          return name;
        },
        'font-size': (node: any) => {
          const level = node.data('level') || 1;
          return Math.max(10, 18 - level * 2) + 'px';
        },
        'width': (node: any) => {
          const level = node.data('level') || 1;
          const isSuperNode = node.data('isSuperNode') || false;
          return isSuperNode ? 120 : Math.max(40, 100 - level * 10);
        },
        'height': (node: any) => {
          const level = node.data('level') || 1;
          const isSuperNode = node.data('isSuperNode') || false;
          return isSuperNode ? 60 : Math.max(30, 80 - level * 8);
        },
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#000',
        'text-outline-width': 1,
        'text-outline-color': '#fff',
        'border-width': 2,
        'border-color': '#666',
        'text-wrap': 'wrap',
        'text-max-width': '150px',
        'shape': (node: any) => {
          const type = node.data('type') || 'module';
          const isSuperNode = node.data('isSuperNode') || false;
          
          if (isSuperNode) return 'round-rectangle';
          
          switch (type) {
            case 'package': return 'round-rectangle';
            case 'module': return 'rectangle';
            case 'class': return 'ellipse';
            case 'method':
            case 'function': return 'triangle';
            case 'field': return 'diamond';
            default: return 'ellipse';
          }
        }
      }
    },
    // SuperNode 스타일
    {
      selector: 'node[isSuperNode="true"]',
      style: {
        'background-color': '#f0f0f0',
        'border-style': 'dashed',
        'border-width': 3,
        'border-color': '#999',
        'opacity': 0.8,
        'font-style': 'italic'
      }
    },
    // 확장된 노드 스타일
    {
      selector: 'node[isExpanded="true"]',
      style: {
        'border-color': '#52c41a',
        'border-width': 4
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
        'opacity': 0.7
      }
    },
    // 하이라이트 상태들
    {
      selector: 'node.highlighted',
      style: {
        'background-color': '#ff4d4f',
        'border-color': '#ff4d4f',
        'border-width': 5,
        'z-index': 999
      }
    },
    // 클래스 노드 하이라이트 특별 스타일
    {
      selector: 'node[type="class"].highlighted',
      style: {
        'background-color': '#ff7875',
        'border-color': '#ff4d4f', 
        'border-width': 6,
        'z-index': 999,
        'overlay-opacity': 0.1,
        'overlay-color': '#ff4d4f'
      }
    },
    {
      selector: 'node.connected',
      style: {
        'background-color': '#52c41a',
        'border-color': '#52c41a',
        'border-width': 4
      }
    },
    {
      selector: 'node.hierarchical',
      style: {
        'background-color': '#1890ff',
        'border-color': '#1890ff',
        'border-width': 3
      }
    },
    {
      selector: 'node.dimmed',
      style: {
        'opacity': 0.2
      }
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#ff4d4f',
        'target-arrow-color': '#ff4d4f',
        'width': 4
      }
    },
    // 순환 참조 노드 스타일 - 기본
    {
      selector: 'node.in-cycle',
      style: {
        'border-color': '#ff4d4f',
        'border-width': 5,
        'border-style': 'solid',
        'border-opacity': 1,
        'overlay-opacity': 0.15,
        'overlay-color': '#ff4d4f',
        'z-index': 50  // 다른 노드보다 위에 표시
      }
    },
    // 고위험 순환 참조 노드
    {
      selector: 'node.cycle-high',
      style: {
        'border-color': '#ff4d4f',
        'border-width': 7,
        'border-style': 'solid',
        'border-opacity': 1,
        'text-outline-color': '#ff4d4f',
        'text-outline-width': 2,
        'overlay-opacity': 0.25,
        'overlay-color': '#ff4d4f',
        'z-index': 60
      }
    },
    // 중위험 순환 참조 노드
    {
      selector: 'node.cycle-medium',
      style: {
        'border-color': '#ff4d4f',
        'border-width': 5,
        'border-style': 'solid',
        'border-opacity': 1,
        'text-outline-color': '#fa8c16',
        'text-outline-width': 1,
        'overlay-opacity': 0.2,
        'overlay-color': '#fa8c16',
        'z-index': 55
      }
    },
    // 저위험 순환 참조 노드
    {
      selector: 'node.cycle-low',
      style: {
        'border-color': '#ff4d4f',
        'border-width': 4,
        'border-style': 'solid',
        'border-opacity': 1,
        'text-outline-color': '#faad14',
        'text-outline-width': 1,
        'overlay-opacity': 0.15,
        'overlay-color': '#faad14',
        'z-index': 52
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
    // 고위험 순환 참조 엣지
    {
      selector: 'edge.cycle-high',
      style: {
        'line-color': '#ff4d4f',
        'target-arrow-color': '#ff4d4f',
        'source-arrow-color': '#ff4d4f',
        'width': 6,
        'line-style': 'solid',
        'opacity': 1,
        'z-index': 60,
        'arrow-scale': 2
      }
    },
    // 중위험 순환 참조 엣지
    {
      selector: 'edge.cycle-medium',
      style: {
        'line-color': '#ff4d4f',
        'target-arrow-color': '#ff4d4f',
        'source-arrow-color': '#ff4d4f',
        'width': 5,
        'line-style': 'solid',
        'opacity': 1,
        'z-index': 55,
        'arrow-scale': 1.7
      }
    },
    // 저위험 순환 참조 엣지
    {
      selector: 'edge.cycle-low',
      style: {
        'line-color': '#ff4d4f',
        'target-arrow-color': '#ff4d4f',
        'source-arrow-color': '#ff4d4f',
        'width': 4,
        'line-style': 'solid',
        'opacity': 1,
        'z-index': 52,
        'arrow-scale': 1.5
      }
    },
    {
      selector: 'edge.dimmed',
      style: {
        'opacity': 0.1
      }
    }
  ];

  // 계층적 레이아웃
  const getHierarchicalLayout = (type: string) => {
    switch (type) {
      case 'clustered':
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
      case 'hierarchical-force':
        return {
          name: 'cose',
          animate: false,
          nodeRepulsion: 8000,
          idealEdgeLength: 120,
          edgeElasticity: 100,
          nestingFactor: enableClustering ? 0.1 : 5,
          gravity: 80,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0
        };
      case 'hierarchical-tree':
        return {
          name: 'breadthfirst',
          directed: true,
          spacingFactor: 1.75,
          padding: 50,
          avoidOverlap: true,
          animate: false
        };
      case 'compound':
        return {
          name: 'cose',
          animate: false,
          nodeRepulsion: 10000,
          idealEdgeLength: 150,
          nestingFactor: 12,
          gravity: 100
        };
      case 'cola':
        return {
          name: 'cola',
          animate: false,
          refresh: 1,
          maxSimulationTime: 4000,
          ungrabifyWhileSimulating: false,
          fit: true,
          padding: 30,
          nodeDimensionsIncludeLabels: true,
          randomize: false,
          avoidOverlap: true,
          handleDisconnected: true,
          convergenceThreshold: 0.01,
          nodeSpacing: 5,
          flow: undefined,
          alignment: undefined,
          gapInequalities: undefined
        };
      default:
        return {
          name: 'cose',
          animate: false,
          nodeRepulsion: 5000,
          idealEdgeLength: 100
        };
    }
  };

  // 레벨 변경 핸들러
  const handleLevelChange = async (newLevel: number) => {
    setIsLevelChanging(true);
    message.loading(`Switching to ${getLevelName(newLevel)} level...`, 0.5);
    
    // Give UI time to show loading state
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setViewLevel(newLevel);
    setExpandedNodes(new Set()); // 레벨 변경 시 확장 상태 초기화
    
    // Additional delay to prevent UI freezing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    setIsLevelChanging(false);
    message.success(`Now viewing ${getLevelName(newLevel)} level`);
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
    message.success('모든 노드가 확장되었습니다');
  };



  return (
    <div style={{ width: '100%', height: '85vh', display: 'flex', flexDirection: 'column' }}>
      {/* 컨트롤 패널 - 상단 고정 */}
      <Card 
        size="small" 
        title="🎛️ Hierarchical Controls"
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
              
              <Button size="small" onClick={expandAll} icon={<ExpandOutlined />}>
                Expand All
              </Button>

              <Button 
                size="small" 
                onClick={() => cyInstanceRef.current?.fit()}
                icon={<ReloadOutlined />}
              >
                Fit
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
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#1890ff' }}>
                    📋 Selected Node
                  </div>
                  
                  {nodeInfo ? (
                    <div style={{ fontSize: 10, lineHeight: 1.3, display: 'flex', gap: 12 }}>
                      {/* 왼쪽: 기본 정보 */}
                      <div style={{ flex: '0 0 auto' }}>
                        <div><strong>Name:</strong> {nodeInfo.name}</div>
                        <div><strong>Type:</strong> 
                          <Tag color={
                            nodeInfo.type === 'package' ? 'green' :
                            nodeInfo.type === 'module' ? 'blue' :
                            nodeInfo.type === 'class' ? 'orange' :
                            nodeInfo.type === 'method' ? 'purple' :
                            nodeInfo.type === 'field' ? 'cyan' : 'default'
                          } style={{ marginLeft: 4, fontSize: 9 }}>
                            {nodeInfo.type.toUpperCase()}
                          </Tag>
                        </div>
                      </div>
                      
                      {/* 오른쪽: 연결된 노드 정보 */}
                      {(incoming.length > 0 || outgoing.length > 0) && (
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 8, borderLeft: '1px solid #e0e0e0' }}>
                          {incoming.length > 0 && (
                            <div style={{ marginBottom: 2 }}>
                              <div style={{ fontSize: 10, fontWeight: 500, color: '#52c41a' }}>← In ({incoming.length}):</div>
                              <div style={{ fontSize: 9, color: '#666' }}>
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
                              <div style={{ fontSize: 10, fontWeight: 500, color: '#1890ff' }}>→ Out ({outgoing.length}):</div>
                              <div style={{ fontSize: 9, color: '#666' }}>
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
                        <div style={{ marginTop: 4, fontSize: 9, color: '#666' }}>
                          👶 Children: {nodeInfo.children.length}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: '#999' }}>
                      No node selected
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
              Rendering {getLevelName(viewLevel)} Level...
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              Optimizing layout for better performance
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HierarchicalNetworkGraph;
