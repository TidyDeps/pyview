import React, { useRef, useEffect, useState } from 'react';
import { Card, Button, Switch, Select, Space, Tooltip, message } from 'antd';
import { 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  ReloadOutlined, 
  HighlightOutlined,
  AppstoreOutlined 
} from '@ant-design/icons';
import cytoscape from 'cytoscape';

const { Option } = Select;

interface EnhancedNetworkGraphProps {
  data: any;
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

const EnhancedNetworkGraph: React.FC<EnhancedNetworkGraphProps> = ({ 
  data, 
  onNodeClick,
  selectedNodeId 
}) => {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<cytoscape.Core | null>(null);
  const [highlightMode, setHighlightMode] = useState(false);
  const [containerMode, setContainerMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [layoutType, setLayoutType] = useState('force-directed');

  useEffect(() => {
    console.log('EnhancedNetworkGraph useEffect triggered with data:', data);
    if (!cyRef.current || !data) {
      console.log('EnhancedNetworkGraph - Missing cyRef or data:', { cyRef: !!cyRef.current, data: !!data });
      return;
    }

    try {
      // 기존 인스턴스 정리
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy();
      }

      // 데이터 변환
      const elements = transformDataToCytoscape(data);
      
      console.log('EnhancedNetworkGraph - About to create Cytoscape with elements:', elements.length);
      
      // Cytoscape 인스턴스 생성
      const cy = cytoscape({
        container: cyRef.current,
        elements,
        style: getStylesheet(),
        layout: getLayoutConfig(layoutType),
        wheelSensitivity: 1.5,
        minZoom: 0.1,
        maxZoom: 3
      });

      console.log('EnhancedNetworkGraph - Cytoscape instance created successfully');
      cyInstanceRef.current = cy;

      // 레이아웃 완료 후 자동으로 화면에 맞춤
      cy.ready(() => {
        const layout = cy.layout(getLayoutConfig(layoutType));
        
        layout.on('layoutstop', () => {
          console.log('EnhancedNetworkGraph - Layout completed');
          setTimeout(() => {
            cy.fit();
            cy.center();
            // 초기 줌을 적당히 축소해서 전체 그래프를 넓게 보이게 함
            const currentZoom = cy.zoom();
            cy.zoom(currentZoom * 0.4);
          }, 500);
        });
        
        layout.run();
      });

      // 노드 클릭 이벤트
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const nodeId = node.id();
        
        if (highlightMode) {
          handleNodeHighlight(cy, nodeId);
        }
        
        setSelectedNode(nodeId);
        onNodeClick?.(nodeId);
        message.info(`Selected: ${node.data('name') || nodeId}`);
      });

      // 배경 클릭 시 하이라이트 해제
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          clearHighlights(cy);
          setSelectedNode(null);
        }
      });

    } catch (error) {
      console.error('Error initializing Enhanced Graph:', error);
    }

    return () => {
      if (cyInstanceRef.current) {
        try {
          cyInstanceRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying Enhanced cytoscape instance:', error);
        } finally {
          cyInstanceRef.current = null;
        }
      }
    };
  }, [data, highlightMode, containerMode, layoutType]);

  // Handle external node selection (from file tree)
  useEffect(() => {
    if (!cyInstanceRef.current || !selectedNodeId) return;

    const cy = cyInstanceRef.current;
    
    // Clear previous highlights
    cy.elements().removeClass('highlighted connected dimmed');
    
    // Find and highlight the selected node
    const targetNode = cy.getElementById(selectedNodeId);
    
    if (targetNode.length > 0) {
      // Highlight the node
      targetNode.addClass('highlighted');
      
      // Center and zoom to the node
      cy.animate({
        center: { eles: targetNode },
        zoom: 1.5
      }, {
        duration: 500
      });
      
      console.log('EnhancedNetworkGraph - Centered on node:', selectedNodeId);
    } else {
      // Try to find node by partial match
      const allNodes = cy.nodes();
      const matchingNode = allNodes.filter(node => {
        const nodeData = node.data();
        return nodeData.id.includes(selectedNodeId) || 
               nodeData.name.includes(selectedNodeId) ||
               selectedNodeId.includes(nodeData.id);
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
        console.log('EnhancedNetworkGraph - Centered on matching node:', firstMatch.id());
      } else {
        console.warn('EnhancedNetworkGraph - Node not found:', selectedNodeId);
      }
    }
  }, [selectedNodeId]);

  // 데이터를 Cytoscape 형식으로 변환
  const transformDataToCytoscape = (inputData: any) => {
    console.log('EnhancedNetworkGraph - Input data:', inputData);
    const elements: any[] = [];
    const nodeIds = new Set<string>();

    // 노드 변환 및 ID 수집
    if (inputData.nodes) {
      console.log('EnhancedNetworkGraph - Processing nodes:', inputData.nodes.length);
      inputData.nodes.forEach((node: any) => {
        const nodeId = node.id;
        nodeIds.add(nodeId);
        elements.push({
          data: {
            id: nodeId,
            name: node.name || nodeId,
            type: node.type || 'unknown'
          }
        });
      });
    }

    // 엣지 변환 - 존재하는 노드들 간의 엣지만 생성
    if (inputData.edges) {
      console.log('EnhancedNetworkGraph - Processing edges:', inputData.edges.length);
      let validEdges = 0;
      let skippedEdges = 0;
      
      inputData.edges.forEach((edge: any) => {
        const sourceExists = nodeIds.has(edge.source);
        const targetExists = nodeIds.has(edge.target);
        
        if (sourceExists && targetExists) {
          elements.push({
            data: {
              id: `${edge.source}-${edge.target}`,
              source: edge.source,
              target: edge.target,
              type: edge.type || 'dependency'
            }
          });
          validEdges++;
        } else {
          skippedEdges++;
          console.warn('EnhancedNetworkGraph - Skipping edge due to missing nodes:', {
            edge,
            sourceExists,
            targetExists
          });
        }
      });
      
      console.log(`EnhancedNetworkGraph - Edges: ${validEdges} valid, ${skippedEdges} skipped`);
    }

    console.log('EnhancedNetworkGraph - Final elements:', elements.length, elements);
    return elements;
  };

  // 스타일시트 정의
  const getStylesheet = () => [
    {
      selector: 'node',
      style: {
        'background-color': (node: any) => {
          const type = node.data('type');
          switch (type) {
            case 'package': return '#1890ff';
            case 'module': return '#52c41a'; 
            case 'class': return '#fa8c16';
            case 'method': return '#eb2f96';
            case 'field': return '#722ed1';
            default: return '#d9d9d9';
          }
        },
        'label': 'data(name)',
        'font-size': containerMode ? '14px' : '12px',
        'width': containerMode ? 80 : 60,
        'height': containerMode ? 80 : 60,
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#000',
        'text-outline-width': 2,
        'text-outline-color': '#fff',
        'border-width': 3,
        'border-color': '#666',
        'text-wrap': 'wrap',
        'text-max-width': containerMode ? '120px' : '100px'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 3,
        'line-color': '#888',
        'target-arrow-color': '#888',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 1.5,
        'opacity': 0.8,
        'line-style': 'solid'
      }
    },
    // 하이라이트 상태
    {
      selector: 'node.highlighted',
      style: {
        'background-color': '#ff4d4f',
        'border-color': '#ff4d4f',
        'border-width': 4,
        'font-weight': 'bold'
      }
    },
    {
      selector: 'node.connected',
      style: {
        'background-color': '#52c41a',
        'border-color': '#52c41a',
        'border-width': 3,
        'opacity': 1
      }
    },
    {
      selector: 'node.dimmed',
      style: {
        'opacity': 0.3
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
        'opacity': 0.2
      }
    }
  ];

  // 노드 하이라이트 처리
  const handleNodeHighlight = (cy: cytoscape.Core, nodeId: string) => {
    clearHighlights(cy);

    const targetNode = cy.getElementById(nodeId);
    const connectedEdges = targetNode.connectedEdges();
    const connectedNodes = connectedEdges.connectedNodes();

    // 선택된 노드 하이라이트
    targetNode.addClass('highlighted');
    
    // 연결된 노드들 하이라이트
    connectedNodes.addClass('connected');
    
    // 연결된 엣지들 하이라이트
    connectedEdges.addClass('highlighted');
    
    // 나머지 요소들 흐리게
    cy.nodes().not(targetNode).not(connectedNodes).addClass('dimmed');
    cy.edges().not(connectedEdges).addClass('dimmed');
  };

  const clearHighlights = (cy: cytoscape.Core) => {
    cy.elements().removeClass('highlighted connected dimmed');
  };

  const getLayoutConfig = (type: string) => {
    switch (type) {
      case 'hierarchical':
        return {
          name: 'breadthfirst',
          directed: true,
          spacingFactor: containerMode ? 3 : 2.5,
          padding: 100,
          avoidOverlap: true,
          animate: true,
          animationDuration: 1000
        };
      case 'circular':
        return {
          name: 'circle',
          radius: containerMode ? 400 : 300,
          spacingFactor: 3,
          padding: 100,
          animate: true,
          animationDuration: 1000
        };
      case 'grid':
        return {
          name: 'grid',
          cols: containerMode ? 12 : 15,
          rows: undefined,
          padding: 100,
          avoidOverlap: true,
          animate: true,
          animationDuration: 1000
        };
      default: // force-directed
        return {
          name: 'cose',
          animate: true,
          animationDuration: 1500,
          nodeRepulsion: containerMode ? 50000 : 40000,
          idealEdgeLength: containerMode ? 180 : 150,
          edgeElasticity: 80,
          nestingFactor: 1,
          gravity: 20,
          numIter: 500,
          initialTemp: 500,
          coolingFactor: 0.95,
          minTemp: 5.0,
          padding: 100,
          fit: true,
          randomize: false,
          nodeOverlap: 30,
          refresh: 10,
          maxSimulationTime: 2000,
          stop: function() {
            console.log('EnhancedNetworkGraph - Layout stopped')
          }
        };
    }
  };

  const handleZoom = (factor: number) => {
    if (cyInstanceRef.current) {
      const currentZoom = cyInstanceRef.current.zoom();
      cyInstanceRef.current.zoom(currentZoom * factor);
    }
  };

  const handleReset = () => {
    if (cyInstanceRef.current) {
      cyInstanceRef.current.fit();
      clearHighlights(cyInstanceRef.current);
      setSelectedNode(null);
    }
  };

  const handleRelayout = () => {
    if (cyInstanceRef.current) {
      cyInstanceRef.current.layout(getLayoutConfig(layoutType)).run();
    }
  };

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* Enhanced Controls */}
      <Card 
        size="small" 
        style={{ 
          position: 'absolute', 
          top: 10, 
          left: 10, 
          zIndex: 10,
          minWidth: 300
        }}
      >
        <Space direction="vertical" size="small">
          <Space wrap>
            <Tooltip title="Click nodes to highlight dependencies">
              <Switch
                checked={highlightMode}
                onChange={setHighlightMode}
                checkedChildren={<HighlightOutlined />}
                unCheckedChildren="Highlight"
              />
            </Tooltip>
            
            <Tooltip title="Show hierarchical containers">
              <Switch
                checked={containerMode}
                onChange={setContainerMode}
                checkedChildren={<AppstoreOutlined />}
                unCheckedChildren="Containers"
              />
            </Tooltip>
          </Space>
          
          <Space>
            <Select
              value={layoutType}
              onChange={setLayoutType}
              style={{ width: 120 }}
            >
              <Option value="force-directed">Force</Option>
              <Option value="hierarchical">Hierarchical</Option>
              <Option value="circular">Circular</Option>
              <Option value="grid">Grid</Option>
            </Select>
            
            <Button size="small" onClick={() => handleZoom(1.7)}>
              <ZoomInOutlined />
            </Button>
            <Button size="small" onClick={() => handleZoom(0.6)}>
              <ZoomOutOutlined />
            </Button>
            <Button size="small" onClick={handleReset}>
              <ReloadOutlined />
            </Button>
            <Button size="small" onClick={handleRelayout}>
              Re-layout
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Selected Node Info */}
      {selectedNode && (
        <Card
          size="small"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 10,
            maxWidth: 200
          }}
        >
          <div style={{ fontSize: 12 }}>
            <strong>Selected:</strong><br />
            {selectedNode}
          </div>
        </Card>
      )}

      {/* Cytoscape Container */}
      <div 
        ref={cyRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          backgroundColor: 'var(--ant-color-bg-container, #fff)',
          border: '1px solid var(--ant-color-border)',
          borderRadius: 6
        }} 
      />
    </div>
  );
};

export default EnhancedNetworkGraph;