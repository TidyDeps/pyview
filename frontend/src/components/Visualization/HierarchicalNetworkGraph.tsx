import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, Button, Switch, Select, Space, Tooltip, message, Slider, Tag } from 'antd';
import { 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  ReloadOutlined, 
  HighlightOutlined,
  AppstoreOutlined,
  ExpandOutlined,
  CompressOutlined,
  ClusterOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import cytoscape from 'cytoscape';

const { Option } = Select;

interface HierarchicalNode {
  id: string;
  name: string;
  type: 'package' | 'module' | 'class' | 'method' | 'field';
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

interface HierarchicalGraphProps {
  data: any;
  onNodeClick?: (nodeId: string) => void;
}

const HierarchicalNetworkGraph: React.FC<HierarchicalGraphProps> = ({ 
  data, 
  onNodeClick 
}) => {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<cytoscape.Core | null>(null);
  
  // 상태 관리
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [layoutType, setLayoutType] = useState('hierarchical-force');
  const [viewLevel, setViewLevel] = useState(1); // 0=package, 1=module, 2=class, 3=method, 4=field
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [highlightMode, setHighlightMode] = useState(true);
  const [clusterMode, setClusterMode] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);
  
  // 계층적 노드 구조
  const [hierarchicalData, setHierarchicalData] = useState<{
    nodes: HierarchicalNode[];
    edges: any[];
    hierarchy: Record<string, string[]>;
  }>({ nodes: [], edges: [], hierarchy: {} });

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
      const classId = nodeId.split(':').slice(0, 3).join(':');
      return allNodes.find(n => n.id === classId)?.id;
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

  // Cytoscape 그래프 업데이트
  useEffect(() => {
    if (!cyRef.current || !hierarchicalData.nodes.length) return;

    try {
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
        wheelSensitivity: 0.3,
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

    return () => {
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy();
        cyInstanceRef.current = null;
      }
    };
  }, [hierarchicalData, viewLevel, expandedNodes, layoutType]);

  // 요소들을 Cytoscape 형식으로 변환
  const transformToElements = (visibleNodes: HierarchicalNode[], edges: any[]) => {
    const elements: any[] = [];
    const nodeIds = new Set(visibleNodes.map(n => n.id));

    // 노드 변환
    visibleNodes.forEach(node => {
      elements.push({
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          level: node.level,
          isSuperNode: node.isSuperNode,
          isExpanded: node.isExpanded,
          childCount: node.childCount,
          parent: clusterMode ? getClusterParent(node) : undefined
        }
      });
    });

    // 엣지 변환 (보이는 노드들 간의 연결만)
    edges.forEach(edge => {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        elements.push({
          data: {
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            type: edge.type || 'dependency'
          }
        });
      }
    });

    return elements;
  };

  // 클러스터 부모 결정
  const getClusterParent = (node: HierarchicalNode): string | undefined => {
    if (!clusterMode || node.level === 0) return undefined;
    return node.parent;
  };

  // 이벤트 핸들러 설정
  const setupEventHandlers = (cy: cytoscape.Core) => {
    // 노드 클릭 (확장/축소)
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData = node.data();
      const nodeId = nodeData.id;
      
      setSelectedNode(nodeId);
      
      // SuperNode이거나 자식이 있는 노드는 확장/축소
      if (nodeData.isSuperNode || hierarchicalData.hierarchy[nodeId]) {
        toggleNodeExpansion(nodeId);
      }
      
      // 하이라이트 모드
      if (highlightMode) {
        handleHierarchicalHighlight(cy, nodeId);
      }
      
      onNodeClick?.(nodeId);
      
      const action = expandedNodes.has(nodeId) ? 'Collapsed' : 'Expanded';
      message.info(`${action}: ${nodeData.name}`);
    });

    // 배경 클릭
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        clearHighlights(cy);
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
    clearHighlights(cy);

    const targetNode = cy.getElementById(nodeId);
    const connectedEdges = targetNode.connectedEdges();
    const connectedNodes = connectedEdges.connectedNodes();

    // 계층적 관계 하이라이트
    const relatedNodes = getHierarchicallyRelatedNodes(cy, nodeId);
    
    targetNode.addClass('highlighted');
    connectedNodes.addClass('connected');
    relatedNodes.addClass('hierarchical');
    connectedEdges.addClass('highlighted');
    
    // 나머지 흐리게
    cy.nodes().not(targetNode).not(connectedNodes).not(relatedNodes).addClass('dimmed');
    cy.edges().not(connectedEdges).addClass('dimmed');
  };

  // 계층적으로 관련된 노드들 찾기
  const getHierarchicallyRelatedNodes = (cy: cytoscape.Core, nodeId: string): cytoscape.NodeCollection => {
    const node = hierarchicalData.nodes.find(n => n.id === nodeId);
    if (!node) return cy.collection();

    let relatedIds: string[] = [];
    
    // 부모 노드
    if (node.parent) relatedIds.push(node.parent);
    
    // 자식 노드들
    if (node.children) relatedIds.push(...node.children);
    
    // 형제 노드들 (같은 부모를 가진 노드들)
    if (node.parent) {
      const siblings = hierarchicalData.nodes
        .filter(n => n.parent === node.parent && n.id !== nodeId)
        .map(n => n.id);
      relatedIds.push(...siblings);
    }

    return cy.nodes().filter(n => relatedIds.includes(n.id()));
  };

  const clearHighlights = (cy: cytoscape.Core) => {
    cy.elements().removeClass('highlighted connected dimmed hierarchical');
  };

  // 계층적 스타일시트
  const getHierarchicalStylesheet = () => [
    // 기본 노드 스타일
    {
      selector: 'node',
      style: {
        'background-color': (node: any) => {
          const type = node.data('type');
          const level = node.data('level');
          const isSuperNode = node.data('isSuperNode');
          
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
          const name = node.data('name');
          const isSuperNode = node.data('isSuperNode');
          const childCount = node.data('childCount');
          
          if (isSuperNode && childCount) {
            return `${name} (${childCount})`;
          }
          
          return name;
        },
        'font-size': (node: any) => {
          const level = node.data('level');
          return Math.max(10, 18 - level * 2) + 'px';
        },
        'width': (node: any) => {
          const level = node.data('level');
          const isSuperNode = node.data('isSuperNode');
          return isSuperNode ? 120 : Math.max(40, 100 - level * 10);
        },
        'height': (node: any) => {
          const level = node.data('level');
          const isSuperNode = node.data('isSuperNode');
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
          const type = node.data('type');
          const isSuperNode = node.data('isSuperNode');
          
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
      selector: 'node[isSuperNode = true]',
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
      selector: 'node[isExpanded = true]',
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
        'border-width': 5
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
      case 'hierarchical-force':
        return {
          name: 'cose',
          animate: true,
          animationDuration: 1500,
          nodeRepulsion: 8000,
          idealEdgeLength: 120,
          edgeElasticity: 100,
          nestingFactor: 5,
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
          animate: true
        };
      case 'compound':
        return {
          name: 'cose',
          animate: true,
          nodeRepulsion: 10000,
          idealEdgeLength: 150,
          nestingFactor: 12,
          gravity: 100
        };
      default:
        return {
          name: 'cose',
          animate: true,
          nodeRepulsion: 5000,
          idealEdgeLength: 100
        };
    }
  };

  // 레벨 변경 핸들러
  const handleLevelChange = (newLevel: number) => {
    setViewLevel(newLevel);
    setExpandedNodes(new Set()); // 레벨 변경 시 확장 상태 초기화
    message.info(`Viewing ${getLevelName(newLevel)} level`);
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

  const collapseAll = () => {
    setExpandedNodes(new Set());
    message.success('모든 노드가 축소되었습니다');
  };

  return (
    <div style={{ width: '100%', height: '700px', position: 'relative' }}>
      {/* 향상된 컨트롤 패널 */}
      <Card 
        size="small" 
        title="🎛️ Hierarchical Controls"
        style={{ 
          position: 'absolute', 
          top: 10, 
          left: 10, 
          zIndex: 10,
          minWidth: 350,
          maxWidth: 400
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {/* 레벨 컨트롤 */}
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              View Level: <Tag color="blue">{getLevelName(viewLevel)}</Tag>
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

          {/* 모드 스위치들 */}
          <Space wrap>
            <Tooltip title="Click highlighting">
              <Switch
                checked={highlightMode}
                onChange={setHighlightMode}
                checkedChildren={<HighlightOutlined />}
                unCheckedChildren="Highlight"
                size="small"
              />
            </Tooltip>
            
            <Tooltip title="Group by hierarchy">
              <Switch
                checked={clusterMode}
                onChange={setClusterMode}
                checkedChildren={<ClusterOutlined />}
                unCheckedChildren="Cluster"
                size="small"
              />
            </Tooltip>
            
            <Tooltip title="Show overview minimap">
              <Switch
                checked={showMinimap}
                onChange={setShowMinimap}
                checkedChildren="Map"
                unCheckedChildren="Map"
                size="small"
              />
            </Tooltip>
          </Space>

          {/* 레이아웃 선택 */}
          <Space>
            <Select
              value={layoutType}
              onChange={setLayoutType}
              style={{ width: 140 }}
              size="small"
            >
              <Option value="hierarchical-force">Hierarchical Force</Option>
              <Option value="hierarchical-tree">Tree</Option>
              <Option value="compound">Compound</Option>
            </Select>
          </Space>

          {/* 확장/축소 버튼들 */}
          <Space>
            <Button size="small" onClick={expandAll} icon={<ExpandOutlined />}>
              Expand All
            </Button>
            <Button size="small" onClick={collapseAll} icon={<CompressOutlined />}>
              Collapse All
            </Button>
            <Button 
              size="small" 
              onClick={() => cyInstanceRef.current?.fit()}
              icon={<ReloadOutlined />}
            >
              Fit
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 선택된 노드 정보 */}
      {selectedNode && (
        <Card
          size="small"
          title="📋 Node Info"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 10,
            maxWidth: 250
          }}
        >
          <div style={{ fontSize: 12 }}>
            <div><strong>ID:</strong> {selectedNode}</div>
            <div><strong>Level:</strong> {getLevelName(viewLevel)}</div>
            <div><strong>Expanded:</strong> {expandedNodes.size} nodes</div>
            {hierarchicalData.hierarchy[selectedNode] && (
              <div><strong>Children:</strong> {hierarchicalData.hierarchy[selectedNode].length}</div>
            )}
          </div>
        </Card>
      )}

      {/* 미니맵 */}
      {showMinimap && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            width: 200,
            height: 150,
            border: '1px solid #ccc',
            backgroundColor: '#f9f9f9',
            zIndex: 10,
            borderRadius: 4
          }}
        >
          <div style={{ padding: 5, fontSize: 10, textAlign: 'center' }}>
            Minimap (Coming Soon)
          </div>
        </div>
      )}

      {/* Cytoscape 컨테이너 */}
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
    </div>
  );
};

export default HierarchicalNetworkGraph;
