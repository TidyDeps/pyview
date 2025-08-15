// 2D Network Graph Visualization Component using D3.js
import React, { useRef, useEffect, useState } from 'react'
import { Card, Select, Space, Button, Typography, Slider } from 'antd'
import { FullscreenOutlined, ReloadOutlined } from '@ant-design/icons'
import * as d3 from 'd3'

const { Title, Text } = Typography
const { Option } = Select

interface Node {
  id: string
  name: string
  type: 'package' | 'module' | 'class' | 'method' | 'field'
  x?: number
  y?: number
  fx?: number
  fy?: number
}

interface Edge {
  source: string | Node
  target: string | Node
  type: 'import' | 'inheritance' | 'composition' | 'call' | 'reference'
}

interface DependencyGraph2DProps {
  data?: {
    nodes: Node[]
    edges: Edge[]
  }
  onNodeClick?: (node: Node) => void
}

const DependencyGraph2D: React.FC<DependencyGraph2DProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<Node, Edge> | null>(null)
  
  const [selectedLevel, setSelectedLevel] = useState<string>('module')
  const [nodeSize, setNodeSize] = useState<number>(8)
  const [linkDistance, setLinkDistance] = useState<number>(100)
  const [showLabels, setShowLabels] = useState<boolean>(true)

  // Node colors by type
  const nodeColors = {
    package: '#1890ff',
    module: '#52c41a',
    class: '#fa8c16',
    method: '#eb2f96',
    field: '#722ed1'
  }

  // Edge colors by type
  const edgeColors = {
    import: '#595959',
    inheritance: '#13c2c2',
    composition: '#a0d911',
    call: '#f759ab',
    reference: '#2f54eb'
  }

  useEffect(() => {
    if (!data || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    const width = 800
    const height = 600

    svg.selectAll('*').remove()

    // Filter nodes by selected level
    const filteredNodes = data.nodes.filter(node => 
      selectedLevel === 'all' || node.type === selectedLevel
    )

    // Filter edges based on filtered nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredEdges = data.edges.filter(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id
      return nodeIds.has(sourceId) && nodeIds.has(targetId)
    })

    // Create force simulation
    const simulation = d3.forceSimulation<Node>(filteredNodes)
      .force('link', d3.forceLink<Node, Edge>(filteredEdges)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(0.3)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(nodeSize + 5))

    simulationRef.current = simulation

    // Create container group
    const container = svg.append('g')

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create links
    const links = container
      .selectAll('.link')
      .data(filteredEdges)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', d => edgeColors[d.type] || '#999')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)

    // Create nodes
    const nodes = container
      .selectAll('.node')
      .data(filteredNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    // Add circles for nodes
    nodes
      .append('circle')
      .attr('r', nodeSize)
      .attr('fill', d => nodeColors[d.type] || '#999')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        onNodeClick?.(d)
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', nodeSize * 1.5)
          .attr('stroke-width', 3)
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', nodeSize)
          .attr('stroke-width', 2)
      })

    // Add labels if enabled
    if (showLabels) {
      nodes
        .append('text')
        .text(d => d.name)
        .attr('x', 0)
        .attr('y', nodeSize + 15)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-family', 'Arial, sans-serif')
        .attr('fill', '#333')
        .style('pointer-events', 'none')
    }

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!)

      nodes
        .attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
    }

  }, [data, selectedLevel, nodeSize, linkDistance, showLabels, onNodeClick])

  // Generate sample 2D data for demo
  const generateSample2DData = () => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    
    // Create sample nodes in a more 2D-friendly layout
    const nodeCount = { package: 3, module: 8, class: 12, method: 20, field: 15 }
    
    Object.entries(nodeCount).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        nodes.push({
          id: `${type}_${i}`,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${i + 1}`,
          type: type as Node['type']
        })
      }
    })
    
    // Create sample edges
    for (let i = 0; i < Math.min(nodes.length * 1.5, 40); i++) {
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

  const sampleData = data || generateSample2DData()

  const handleReset = () => {
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart()
    }
  }

  const handleFullscreen = () => {
    if (svgRef.current?.parentElement) {
      svgRef.current.parentElement.requestFullscreen()
    }
  }

  return (
    <Card
      title="2D Dependency Network Graph"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            Reset Layout
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
          
          <div style={{ width: 150 }}>
            <Text>Node Size: </Text>
            <Slider
              min={4}
              max={20}
              value={nodeSize}
              onChange={setNodeSize}
              style={{ width: 100 }}
            />
          </div>

          <div style={{ width: 150 }}>
            <Text>Link Distance: </Text>
            <Slider
              min={50}
              max={200}
              value={linkDistance}
              onChange={setLinkDistance}
              style={{ width: 100 }}
            />
          </div>
        </Space>
      </div>
      
      <svg
        ref={svgRef}
        width="100%"
        height="600"
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          background: '#fafafa'
        }}
      />
      
      <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
        <Space wrap>
          <div>🔵 Package</div>
          <div>🟢 Module</div>
          <div>🟠 Class</div>
          <div>🟡 Method</div>
          <div>🟣 Field</div>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            Drag nodes to rearrange • Scroll to zoom • Click nodes for details
          </Text>
        </div>
      </div>
    </Card>
  )
}

export default DependencyGraph2D