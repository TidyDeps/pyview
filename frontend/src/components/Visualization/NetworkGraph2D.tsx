// 2D Network Graph using Cytoscape.js
import React, { useRef, useEffect, useState } from 'react'
import { Card, Select, Space, Button, Typography, Slider, Switch } from 'antd'
import { FullscreenOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import cytoscape from 'cytoscape'

const { Text } = Typography
const { Option } = Select

interface Node {
  id: string
  name: string
  type: 'package' | 'module' | 'class' | 'method' | 'field'
}

interface Edge {
  source: string
  target: string
  type: 'import' | 'inheritance' | 'composition' | 'call' | 'reference'
}

interface NetworkGraph2DProps {
  data?: {
    nodes: Node[]
    edges: Edge[]
  }
  onNodeClick?: (node: Node) => void
  selectedNodeId?: string | null
}

const NetworkGraph2D: React.FC<NetworkGraph2DProps> = ({ data, onNodeClick, selectedNodeId }) => {
  const cyRef = useRef<HTMLDivElement>(null)
  const cyInstanceRef = useRef<any>(null)
  
  const [selectedLevel, setSelectedLevel] = useState<string>('module')
  const [layoutType, setLayoutType] = useState<string>('cose')
  const [nodeSize, setNodeSize] = useState<number>(30)
  const [showLabels, setShowLabels] = useState<boolean>(true)
  const [edgeOpacity, setEdgeOpacity] = useState<number>(0.6)

  // 노드 색상 정의
  const nodeColors = {
    package: '#1890ff',
    module: '#52c41a', 
    class: '#fa8c16',
    method: '#eb2f96',
    field: '#722ed1'
  }

  // 엣지 색상 정의
  const edgeColors = {
    import: '#595959',
    inheritance: '#13c2c2',
    composition: '#a0d911',
    call: '#f759ab',
    reference: '#2f54eb'
  }

  // Cytoscape 스타일시트
  const getStylesheet = (): any[] => [
    {
      selector: 'node',
      style: {
        'background-color': (ele: any) => nodeColors[ele.data('type')] || '#999',
        'label': showLabels ? 'data(name)' : '',
        'width': nodeSize,
        'height': nodeSize,
        'font-size': '12px',
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#000',
        'text-outline-width': 2,
        'text-outline-color': '#fff',
        'border-width': 2,
        'border-color': '#fff',
        'cursor': 'pointer'
      }
    },
    {
      selector: 'node:hover',
      style: {
        'border-width': 4,
        'border-color': '#333',
        'width': nodeSize * 1.2,
        'height': nodeSize * 1.2
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': (ele: any) => edgeColors[ele.data('type')] || '#999',
        'target-arrow-color': (ele: any) => edgeColors[ele.data('type')] || '#999',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': edgeOpacity,
        'arrow-scale': 1.2
      }
    }
  ]

  // 데이터를 Cytoscape 형식으로 변환
  const transformData = (inputData: { nodes: Node[], edges: Edge[] }) => {
    console.log('NetworkGraph2D - Input data:', {
      nodes: inputData.nodes.length,
      edges: inputData.edges.length,
      selectedLevel
    })

    const filteredNodes = inputData.nodes.filter(node => 
      selectedLevel === 'all' || node.type === selectedLevel
    )

    console.log('NetworkGraph2D - Filtered nodes:', filteredNodes.length)
    console.log('NetworkGraph2D - Sample filtered nodes:', filteredNodes.slice(0, 3))

    const nodeIds = new Set(filteredNodes.map(n => n.id))
    console.log('NetworkGraph2D - Node IDs set size:', nodeIds.size)
    console.log('NetworkGraph2D - Sample node IDs:', Array.from(nodeIds).slice(0, 5))
    
    const filteredEdges = inputData.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    )

    console.log('NetworkGraph2D - Filtered edges:', filteredEdges.length)
    console.log('NetworkGraph2D - Sample edges before filtering:', inputData.edges.slice(0, 3))
    console.log('NetworkGraph2D - Sample filtered edges:', filteredEdges.slice(0, 3))
    
    // Debug edge filtering
    if (filteredEdges.length === 0 && inputData.edges.length > 0) {
      console.warn('NetworkGraph2D - All edges filtered out! Checking first edge:')
      const firstEdge = inputData.edges[0]
      console.warn('First edge source exists:', nodeIds.has(firstEdge.source))
      console.warn('First edge target exists:', nodeIds.has(firstEdge.target))
      console.warn('First edge:', firstEdge)
    }

    const elements: any[] = [
      ...filteredNodes.map(node => ({
        data: {
          id: node.id,
          name: node.name,
          type: node.type
        }
      })),
      ...filteredEdges.map(edge => ({
        data: {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: edge.type
        }
      }))
    ]

    console.log('NetworkGraph2D - Final elements:', elements.length)
    return elements
  }

  // 레이아웃 옵션
  const getLayoutOptions = (layout: string) => {
    const baseOptions = {
      name: layout,
      animate: true,
      animationDuration: 500,
      fit: true,
      padding: 50
    }

    switch (layout) {
      case 'cose':
        return {
          ...baseOptions,
          nodeRepulsion: 400000,
          nodeOverlap: 20,
          idealEdgeLength: 100,
          edgeElasticity: 100,
          nestingFactor: 5,
          gravity: 80,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0
        }
      case 'circle':
        return {
          ...baseOptions,
          radius: 200,
          spacingFactor: 1.75
        }
      case 'grid':
        return {
          ...baseOptions,
          spacing: 100,
          condense: false
        }
      default:
        return baseOptions
    }
  }

  // 샘플 데이터 생성
  const generateSampleData = () => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    
    const types: Node['type'][] = ['package', 'module', 'class', 'method', 'field']
    const counts = { package: 3, module: 8, class: 12, method: 15, field: 10 }
    
    types.forEach(type => {
      for (let i = 0; i < counts[type]; i++) {
        nodes.push({
          id: `${type}_${i}`,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${i + 1}`,
          type
        })
      }
    })
    
    for (let i = 0; i < Math.min(nodes.length * 0.8, 35); i++) {
      const sourceIdx = Math.floor(Math.random() * nodes.length)
      let targetIdx = Math.floor(Math.random() * nodes.length)
      while (targetIdx === sourceIdx) {
        targetIdx = Math.floor(Math.random() * nodes.length)
      }
      
      edges.push({
        source: nodes[sourceIdx].id,
        target: nodes[targetIdx].id,
        type: ['import', 'inheritance', 'composition', 'call', 'reference'][Math.floor(Math.random() * 5)] as Edge['type']
      })
    }
    
    return { nodes, edges }
  }

  // Cytoscape 초기화 및 업데이트
  useEffect(() => {
    if (!cyRef.current) return

    try {
      const inputData = data || generateSampleData()
      const elements = transformData(inputData)

      // 이전 인스턴스 안전하게 정리
      if (cyInstanceRef.current) {
        try {
          cyInstanceRef.current.removeAllListeners()
          cyInstanceRef.current.destroy()
        } catch (destroyError) {
          console.warn('Error destroying previous cytoscape instance:', destroyError)
        } finally {
          cyInstanceRef.current = null
        }
      }

      // 최소한의 elements 확인
      if (elements.length === 0) {
        console.warn('NetworkGraph2D - No elements to render')
        return
      }

      const cy = cytoscape({
        container: cyRef.current,
        elements,
        style: getStylesheet(),
        layout: getLayoutOptions(layoutType),
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 3
      })

      cy.on('tap', 'node', (evt) => {
        const node = evt.target
        const nodeData = {
          id: node.data('id'),
          name: node.data('name'),
          type: node.data('type')
        }
        onNodeClick?.(nodeData)
      })

      // 레이아웃 완료 후 자동 맞춤
      cy.ready(() => {
        setTimeout(() => {
          if (cyInstanceRef.current === cy) { // 여전히 동일한 인스턴스인지 확인
            try {
              cy.fit()
              cy.center()
            } catch (fitError) {
              console.warn('Error fitting graph:', fitError)
            }
          }
        }, 100)
      })

      cyInstanceRef.current = cy

    } catch (error) {
      console.error('Error initializing Cytoscape:', error)
    }

    return () => {
      if (cyInstanceRef.current) {
        try {
          cyInstanceRef.current.removeAllListeners()
          cyInstanceRef.current.destroy()
        } catch (error) {
          console.warn('Error destroying cytoscape instance:', error)
        } finally {
          cyInstanceRef.current = null
        }
      }
    }
  }, [data, selectedLevel, layoutType, nodeSize, showLabels, edgeOpacity])

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
      
      // Center the view on the node
      cy.animate({
        center: { eles: targetNode },
        zoom: 1.5
      }, {
        duration: 500
      });
      
      console.log('NetworkGraph2D - Centered on node:', selectedNodeId);
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
        console.log('NetworkGraph2D - Centered on matching node:', firstMatch.id());
      } else {
        console.warn('NetworkGraph2D - Node not found:', selectedNodeId);
      }
    }
  }, [selectedNodeId]);

  const handleReset = () => {
    if (cyInstanceRef.current) {
      cyInstanceRef.current.fit()
      cyInstanceRef.current.center()
    }
  }

  const handleRelayout = () => {
    if (cyInstanceRef.current) {
      cyInstanceRef.current.layout(getLayoutOptions(layoutType)).run()
    }
  }

  return (
    <Card
      title="2D Dependency Network Graph"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRelayout}>
            Re-layout
          </Button>
          <Button icon={<SettingOutlined />} onClick={handleReset}>
            Reset View
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <div>
            <Text>Level: </Text>
            <Select
              value={selectedLevel}
              onChange={setSelectedLevel}
              style={{ width: 120 }}
            >
              <Option value="all">All</Option>
              <Option value="package">Package</Option>
              <Option value="module">Module</Option>
              <Option value="class">Class</Option>
              <Option value="method">Method</Option>
              <Option value="field">Field</Option>
            </Select>
          </div>
          
          <div>
            <Text>Layout: </Text>
            <Select
              value={layoutType}
              onChange={setLayoutType}
              style={{ width: 130 }}
            >
              <Option value="cose">Force-directed</Option>
              <Option value="circle">Circle</Option>
              <Option value="grid">Grid</Option>
            </Select>
          </div>

          <div style={{ width: 120 }}>
            <Text>Node Size: </Text>
            <Slider
              min={15}
              max={60}
              value={nodeSize}
              onChange={setNodeSize}
              style={{ width: 80 }}
            />
          </div>

          <div>
            <Switch
              checked={showLabels}
              onChange={setShowLabels}
              checkedChildren="Labels"
              unCheckedChildren="No Labels"
            />
          </div>
        </Space>
      </div>
      
      <div
        ref={cyRef}
        style={{
          width: '100%',
          height: '600px',
          border: '1px solid var(--ant-color-border)',
          borderRadius: 6,
          backgroundColor: 'var(--ant-color-bg-container, #fff)'
        }}
      />
      
      <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
        <Space wrap>
          <div>📦 Package</div>
          <div>📄 Module</div>
          <div>🏷️ Class</div>
          <div>⚙️ Method</div>
          <div>💎 Field</div>
        </Space>
      </div>
    </Card>
  )
}

export default NetworkGraph2D