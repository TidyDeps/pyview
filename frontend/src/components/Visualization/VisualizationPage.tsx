// Visualization Page with Graph and Controls
import React, { useState, useEffect } from 'react'
import { Row, Col, message, Alert, Spin } from 'antd'
import DependencyGraph from './DependencyGraph'
import GraphControls from './GraphControls'
import { ApiService } from '@/services/api'

interface VisualizationPageProps {
  analysisId?: string
}

interface GraphData {
  nodes: Array<{
    id: string
    name: string
    type: 'package' | 'module' | 'class' | 'method' | 'field'
    x: number
    y: number
    z: number
    connections: string[]
  }>
  edges: Array<{
    source: string
    target: string
    type: 'import' | 'inheritance' | 'composition' | 'call' | 'reference'
  }>
}

const VisualizationPage: React.FC<VisualizationPageProps> = ({ analysisId }) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Graph control states
  const [selectedLevel, setSelectedLevel] = useState<string>('module')
  const [nodeSize, setNodeSize] = useState<number>(5)
  const [edgeOpacity, setEdgeOpacity] = useState<number>(0.6)
  const [showLabels, setShowLabels] = useState<boolean>(true)
  const [layoutMode, setLayoutMode] = useState<string>('force')

  // Load analysis data
  useEffect(() => {
    if (!analysisId) return

    const loadAnalysisData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const results = await ApiService.getAnalysisResults(analysisId)
        
        // Transform backend data to graph format
        const transformedData = transformAnalysisToGraph(results)
        setGraphData(transformedData)
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load analysis data'
        setError(errorMessage)
        message.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadAnalysisData()
  }, [analysisId])

  // Transform backend analysis results to graph data format
  const transformAnalysisToGraph = (analysisResults: any): GraphData => {
    const nodes: GraphData['nodes'] = []
    const edges: GraphData['edges'] = []

    // Extract nodes from different levels
    if (analysisResults.packages) {
      analysisResults.packages.forEach((pkg: any, index: number) => {
        nodes.push({
          id: pkg.package_id,
          name: pkg.name,
          type: 'package',
          x: Math.cos(index * 0.5) * 50,
          y: 0,
          z: Math.sin(index * 0.5) * 50,
          connections: pkg.module_ids || []
        })
      })
    }

    if (analysisResults.modules) {
      analysisResults.modules.forEach((mod: any, index: number) => {
        const angle = index * 0.3
        const radius = 30
        nodes.push({
          id: mod.module_id,
          name: mod.name,
          type: 'module',
          x: Math.cos(angle) * radius,
          y: 10,
          z: Math.sin(angle) * radius,
          connections: mod.class_ids || []
        })
      })
    }

    if (analysisResults.classes) {
      analysisResults.classes.forEach((cls: any, index: number) => {
        const angle = index * 0.2
        const radius = 20
        nodes.push({
          id: cls.class_id,
          name: cls.name,
          type: 'class',
          x: Math.cos(angle) * radius,
          y: 20,
          z: Math.sin(angle) * radius,
          connections: [...(cls.method_ids || []), ...(cls.field_ids || [])]
        })
      })
    }

    if (analysisResults.methods) {
      analysisResults.methods.forEach((method: any, index: number) => {
        const angle = index * 0.1
        const radius = 15
        nodes.push({
          id: method.method_id,
          name: method.name,
          type: 'method',
          x: Math.cos(angle) * radius,
          y: 30,
          z: Math.sin(angle) * radius,
          connections: []
        })
      })
    }

    if (analysisResults.fields) {
      analysisResults.fields.forEach((field: any, index: number) => {
        const angle = index * 0.05
        const radius = 10
        nodes.push({
          id: field.field_id,
          name: field.name,
          type: 'field',
          x: Math.cos(angle) * radius,
          y: 40,
          z: Math.sin(angle) * radius,
          connections: []
        })
      })
    }

    // Extract edges from relationships
    if (analysisResults.dependencies) {
      analysisResults.dependencies.forEach((dep: any) => {
        edges.push({
          source: dep.source_id,
          target: dep.target_id,
          type: dep.relationship_type
        })
      })
    }

    return { nodes, edges }
  }

  const handleExport = () => {
    if (!graphData) return
    
    const dataStr = JSON.stringify(graphData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dependency-graph-${analysisId || 'sample'}.json`
    link.click()
    
    URL.revokeObjectURL(url)
    message.success('Graph data exported successfully')
  }

  const handleResetLayout = () => {
    // Reset to default values
    setSelectedLevel('module')
    setNodeSize(5)
    setEdgeOpacity(0.6)
    setShowLabels(true)
    setLayoutMode('force')
    message.info('Layout reset to defaults')
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading visualization data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        message="Visualization Error"
        description={error}
        type="error"
        showIcon
        style={{ margin: '24px 0' }}
      />
    )
  }

  if (!analysisId && !graphData) {
    return (
      <Alert
        message="No Analysis Selected"
        description="Please run an analysis first to visualize the dependency graph."
        type="info"
        showIcon
        style={{ margin: '24px 0' }}
      />
    )
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={18}>
        <DependencyGraph
          data={graphData}
          onNodeClick={(node) => {
            message.info(`Selected: ${node.name} (${node.type})`)
          }}
        />
      </Col>
      
      <Col xs={24} lg={6}>
        <GraphControls
          selectedLevel={selectedLevel}
          onLevelChange={setSelectedLevel}
          nodeSize={nodeSize}
          onNodeSizeChange={setNodeSize}
          edgeOpacity={edgeOpacity}
          onEdgeOpacityChange={setEdgeOpacity}
          showLabels={showLabels}
          onShowLabelsChange={setShowLabels}
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          onExport={handleExport}
          onResetLayout={handleResetLayout}
        />
      </Col>
    </Row>
  )
}

export default VisualizationPage