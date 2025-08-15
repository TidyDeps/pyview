// Visualization Page with Graph and Controls
import React, { useState, useEffect } from 'react'
import { Row, Col, message, Alert, Spin } from 'antd'
import NetworkGraph2D from './NetworkGraph2D'
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

    console.log('Transforming analysis results:', analysisResults)

    // Extract nodes from different levels
    if (analysisResults.packages) {
      analysisResults.packages.forEach((pkg: any, index: number) => {
        nodes.push({
          id: pkg.package_id || `pkg_${index}`,
          name: pkg.name || `Package ${index}`,
          type: 'package',
          x: Math.cos(index * 0.8) * 60,
          y: 20,
          z: Math.sin(index * 0.8) * 60,
          connections: pkg.modules || []
        })
      })
    }

    if (analysisResults.modules) {
      analysisResults.modules.forEach((mod: any, index: number) => {
        const angle = index * (Math.PI * 2) / analysisResults.modules.length
        const radius = 40
        nodes.push({
          id: mod.module_id || `mod_${index}`,
          name: mod.name || `Module ${index}`,
          type: 'module',
          x: Math.cos(angle) * radius,
          y: 0,
          z: Math.sin(angle) * radius,
          connections: []
        })
      })
    }

    if (analysisResults.classes) {
      analysisResults.classes.forEach((cls: any, index: number) => {
        const angle = index * (Math.PI * 2) / analysisResults.classes.length
        const radius = 35 + (index % 2) * 10  // Alternate between two radius levels
        const height = 15 + (index % 3) * 8   // Three height levels
        nodes.push({
          id: cls.class_id || `cls_${index}`,
          name: cls.name || `Class ${index}`,
          type: 'class',
          x: Math.cos(angle) * radius,
          y: height,
          z: Math.sin(angle) * radius,
          connections: [...(cls.method_ids || []), ...(cls.field_ids || [])]
        })
      })
    }

    if (analysisResults.methods) {
      analysisResults.methods.forEach((method: any, index: number) => {
        const angle = index * (Math.PI * 2) / analysisResults.methods.length
        const radius = 20 + (index % 4) * 5  // Four radius levels for better spread
        const height = 30 + (index % 3) * 12  // Three height levels
        nodes.push({
          id: method.method_id || `method_${index}`,
          name: method.name || `Method ${index}`,
          type: 'method',
          x: Math.cos(angle) * radius,
          y: height,
          z: Math.sin(angle) * radius,
          connections: []
        })
      })
    }

    if (analysisResults.fields) {
      analysisResults.fields.forEach((field: any, index: number) => {
        const angle = index * (Math.PI * 2) / analysisResults.fields.length
        const radius = 25 + (index % 3) * 8  // Vary radius slightly for better distribution
        const height = -20 + (index % 2) * 10  // Vary height as well
        nodes.push({
          id: field.field_id || `field_${index}`,
          name: field.name || `Field ${index}`,
          type: 'field',
          x: Math.cos(angle) * radius,
          y: height,
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
      <Col xs={24}>
        <NetworkGraph2D
          data={graphData}
          onNodeClick={(node) => {
            message.info(`Selected: ${node.name} (${node.type})`)
          }}
        />
      </Col>
    </Row>
  )
}

export default VisualizationPage