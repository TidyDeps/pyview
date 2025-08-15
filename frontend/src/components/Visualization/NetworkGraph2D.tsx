// 2D Network Graph using Cytoscape.js
import React, { useRef, useEffect, useState } from 'react'
import { Card, Select, Space, Button, Typography, Slider, Switch } from 'antd'
import { FullscreenOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import cytoscape, { Core, ElementDefinition, Stylesheet } from 'cytoscape'

const { Title, Text } = Typography
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
}

const NetworkGraph2D: React.FC<NetworkGraph2DProps> = ({ data, onNodeClick }) => {
  const cyRef = useRef<HTMLDivElement>(null)
  const cyInstanceRef = useRef<Core | null>(null)
  
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
  const getStylesheet = (): Stylesheet[] => [
    {
      selector: 'node',
      style: {
        'background-color': (ele) => nodeColors[ele.data('type')] || '#999',
        'label': showLabels ? 'data(name)' : '',
        'width': nodeSize,
        'height': nodeSize,
        'font-size': '12px',
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#333',
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
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#ff4d4f',
        'background-color': '#fff2f0'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': (ele) => edgeColors[ele.data('type')] || '#999',
        'target-arrow-color': (ele) => edgeColors[ele.data('type')] || '#999',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': edgeOpacity,
        'arrow-scale': 1.2
      }
    },
    {
      selector: 'edge:hover',
      style: {
        'width': 4,
        'opacity': 1
      }
    },
    // 타입별 특별 스타일
    {
      selector: 'node[type = "package"]',
      style: {
        'shape': 'round-rectangle',
        'width': nodeSize * 1.3,
        'height': nodeSize * 1.1
      }
    },
    {
      selector: 'node[type = "class"]',
      style: {
        'shape': 'round-rectangle'
      }
    },
    {
      selector: 'node[type = "method"]',
      style: {
        'shape': 'ellipse'
      }
    },
    {
      selector: 'node[type = "field"]',
      style: {
        'shape': 'diamond'
      }
    }
  ]

  // 데이터를 Cytoscape 형식으로 변환
  const transformData = (inputData: { nodes: Node[], edges: Edge[] }) => {
    // 선택된 레벨에 따라 노드 필터링
    const filteredNodes = inputData.nodes.filter(node => 
      selectedLevel === 'all' || node.type === selectedLevel
    )

    const nodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredEdges = inputData.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    )

    const elements: ElementDefinition[] = [
      // 노드들
      ...filteredNodes.map(node => ({
        data: {
          id: node.id,
          name: node.name,
          type: node.type
        }
      })),
      // 엣지들
      ...filteredEdges.map(edge => ({
        data: {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: edge.type
        }
      }))
    ]

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
      case 'breadthfirst':
        return {
          ...baseOptions,
          directed: true,
          spacingFactor: 1.75,
          circle: false
        }
      case 'concentric':
        return {
          ...baseOptions,
          concentric: (node: any) => node.degree(),
          levelWidth: () => 2,
          spacingFactor: 1.4
        }
      default:
        return baseOptions
    }
  }

  // 샘플 데이터 생성
  const generateSampleData = () => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    
    // 각 타입별로 노드 생성
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
    
    // 의미있는 연결 생성
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

    const inputData = data || generateSampleData()
    const elements = transformData(inputData)

    if (cyInstanceRef.current) {
      // 기존 인스턴스 업데이트
      cyInstanceRef.current.elements().remove()
      cyInstanceRef.current.add(elements)
      cyInstanceRef.current.style(getStylesheet())
      cyInstanceRef.current.layout(getLayoutOptions(layoutType)).run()
    } else {
      // 새 인스턴스 생성
      const cy = cytoscape({
        container: cyRef.current,
        elements,
        style: getStylesheet(),
        layout: getLayoutOptions(layoutType),
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 3
      })

      // 이벤트 리스너
      cy.on('tap', 'node', (evt) => {
        const node = evt.target
        const nodeData = {
          id: node.data('id'),
          name: node.data('name'),
          type: node.data('type')
        }
        onNodeClick?.(nodeData)
      })

      cyInstanceRef.current = cy
    }

    return () => {
      // cleanup은 컴포넌트 언마운트시에만
    }
  }, [data, selectedLevel, layoutType, nodeSize, showLabels, edgeOpacity])

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

  const handleFullscreen = () => {
    if (cyRef.current) {
      cyRef.current.requestFullscreen()
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
          <Button icon={<FullscreenOutlined />} onClick={handleFullscreen}>
            Fullscreen
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
              <Option value="breadthfirst">Hierarchical</Option>
              <Option value="concentric">Concentric</Option>
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

          <div style={{ width: 120 }}>
            <Text>Edge Opacity: </Text>
            <Slider
              min={0.2}
              max={1}
              step={0.1}
              value={edgeOpacity}
              onChange={setEdgeOpacity}
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
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          background: '#fafafa'
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
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            Click nodes for details • Drag to move • Scroll to zoom • Right-click for context menu
          </Text>
        </div>
      </div>
    </Card>
  )
}

export default NetworkGraph2D