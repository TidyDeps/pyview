// Visualization Page with Graph and Controls
import React, { useState, useEffect } from 'react'
import { Row, Col, message, Alert, Spin, Card, Switch, Space } from 'antd'
import { ExperimentOutlined, ApartmentOutlined, BranchesOutlined } from '@ant-design/icons'
import NetworkGraph2D from './NetworkGraph2D'
import EnhancedNetworkGraph from './EnhancedNetworkGraph'
import { ApiService } from '@/services/api'
import HierarchicalNetworkGraph from './HierarchicalNetworkGraph'

interface VisualizationPageProps {
  analysisId: string | null
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
  const [useEnhancedMode, setUseEnhancedMode] = useState<boolean>(false)
  const [useHierarchicalMode, setUseHierarchicalMode] = useState<boolean>(false)

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
    console.log('Available relationships:', analysisResults.relationships?.length || 0)

    // Get dependency graph data
    const dependencyGraph = analysisResults.dependency_graph || {}
    
    // Extract nodes from different levels
    console.log('Processing nodes from dependency_graph...')
    if (dependencyGraph.packages) {
      console.log('Found packages:', dependencyGraph.packages.length)
      dependencyGraph.packages.forEach((pkg: any, index: number) => {
        const nodeId = pkg.id || pkg.name || `pkg_${index}`
        nodes.push({
          id: nodeId,
          name: pkg.name || `Package ${index}`,
          type: 'package',
          x: Math.cos(index * 0.8) * 60,
          y: 20,
          z: Math.sin(index * 0.8) * 60,
          connections: pkg.modules || []
        })
        if (index < 3) console.log('Package node:', nodeId, pkg.name)
      })
    }

    if (dependencyGraph.modules) {
      console.log('Found modules:', dependencyGraph.modules.length)
      dependencyGraph.modules.forEach((mod: any, index: number) => {
        const angle = index * (Math.PI * 2) / dependencyGraph.modules.length
        const radius = 40
        const nodeId = mod.id || mod.name || `mod_${index}`
        nodes.push({
          id: nodeId,
          name: mod.name || `Module ${index}`,
          type: 'module',
          x: Math.cos(angle) * radius,
          y: 0,
          z: Math.sin(angle) * radius,
          connections: []
        })
        if (index < 3) console.log('Module node:', nodeId, mod.name)
      })
    }

    if (dependencyGraph.classes) {
      dependencyGraph.classes.forEach((cls: any, index: number) => {
        const angle = index * (Math.PI * 2) / dependencyGraph.classes.length
        const radius = 35 + (index % 2) * 10  // Alternate between two radius levels
        const height = 15 + (index % 3) * 8   // Three height levels
        nodes.push({
          id: cls.id || cls.name || `cls_${index}`,
          name: cls.name || `Class ${index}`,
          type: 'class',
          x: Math.cos(angle) * radius,
          y: height,
          z: Math.sin(angle) * radius,
          connections: [...(cls.method_ids || []), ...(cls.field_ids || [])]
        })
      })
    }

    if (dependencyGraph.methods) {
      dependencyGraph.methods.forEach((method: any, index: number) => {
        const angle = index * (Math.PI * 2) / dependencyGraph.methods.length
        const radius = 20 + (index % 4) * 5  // Four radius levels for better spread
        const height = 30 + (index % 3) * 12  // Three height levels
        nodes.push({
          id: method.id || method.name || `method_${index}`,
          name: method.name || `Method ${index}`,
          type: 'method',
          x: Math.cos(angle) * radius,
          y: height,
          z: Math.sin(angle) * radius,
          connections: []
        })
      })
    }

    if (dependencyGraph.fields) {
      dependencyGraph.fields.forEach((field: any, index: number) => {
        const angle = index * (Math.PI * 2) / dependencyGraph.fields.length
        const radius = 25 + (index % 3) * 8  // Vary radius slightly for better distribution
        const height = -20 + (index % 2) * 10  // Vary height as well
        nodes.push({
          id: field.id || field.name || `field_${index}`,
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
    console.log('Processing relationships...')
    if (analysisResults.relationships) {
      console.log('Relationships data:', analysisResults.relationships.slice(0, 5)) // Show first 5
      
      let validEdges = 0
      let invalidEdges = 0
      let moduleCreatedEdges = 0
      const nodeIdSet = new Set(nodes.map(n => n.id))
      const nodeIdArray = Array.from(nodeIdSet)
      
      // Helper function to find matching node by partial ID
      const findNodeByPartialMatch = (entityId: string): string | null => {
        // Direct match first
        if (nodeIdSet.has(entityId)) return entityId
        
        // Try to find module-level match for function calls
        if (entityId.startsWith('func:')) {
          // Extract module path from func:module_path:function_name:line
          const parts = entityId.split(':')
          if (parts.length >= 2) {
            const modulePath = parts[1]
            // Look for matching module
            const moduleNode = nodeIdArray.find(id => 
              id.includes(modulePath) || modulePath.includes(id.replace('mod:', ''))
            )
            if (moduleNode) return moduleNode
          }
        }
        
        // Try to find by name similarity for other entities
        const entityName = entityId.split('.').pop() || entityId.split(':').pop() || entityId
        const matchingNode = nodeIdArray.find(id => 
          id.includes(entityName) || id.endsWith(entityName)
        )
        
        return matchingNode || null
      }
      
      analysisResults.relationships.forEach((dep: any, index: number) => {
        const sourceId = dep.from_entity
        const targetId = dep.to_entity
        
        // Try direct match first
        if (nodeIdSet.has(sourceId) && nodeIdSet.has(targetId)) {
          edges.push({
            source: sourceId,
            target: targetId,
            type: dep.dependency_type || 'import'
          })
          validEdges++
        } else {
          // Try to find matching nodes by partial match
          const matchedSource = findNodeByPartialMatch(sourceId)
          const matchedTarget = findNodeByPartialMatch(targetId)
          
          if (matchedSource && matchedTarget && matchedSource !== matchedTarget) {
            // Check if this edge already exists to avoid duplicates
            const edgeExists = edges.some(e => 
              e.source === matchedSource && e.target === matchedTarget
            )
            
            if (!edgeExists) {
              edges.push({
                source: matchedSource,
                target: matchedTarget,
                type: dep.dependency_type || 'call'
              })
              moduleCreatedEdges++
            }
          } else {
            invalidEdges++
            if (index < 5) { // Show first 5 invalid edges for debugging
              console.warn('Invalid edge - no matching nodes:', {
                sourceId,
                targetId,
                matchedSource,
                matchedTarget,
                dependency: dep
              })
            }
          }
        }
      })
      
      console.log(`Relationships processed: ${validEdges} direct, ${moduleCreatedEdges} module-level, ${invalidEdges} invalid edges`)
    } else {
      console.warn('No relationships found in analysis results')
    }

    console.log(`Final graph data: ${nodes.length} nodes, ${edges.length} edges`)
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
    <div>
      {/* Graph Mode Toggle */}
      <Card 
        size="small" 
        style={{ marginBottom: 16 }}
        title="🚀 Visualization Controls"
      >
        <Space align="center">
          <Switch
            checked={useEnhancedMode}
            onChange={setUseEnhancedMode}
            checkedChildren={<ExperimentOutlined />}
            unCheckedChildren={<ApartmentOutlined />}
          />
          <span style={{ fontWeight: 500 }}>
            {useEnhancedMode ? 'Enhanced Mode' : 'Standard Mode'}
          </span>
          <span style={{ color: '#666', fontSize: 12 }}>
            {useEnhancedMode 
              ? '✨ Click highlighting + Container grouping' 
              : '📊 Basic network visualization'
            }
          </span>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          {/* 모드 선택 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <Switch
                checked={useEnhancedMode}
                onChange={setUseEnhancedMode}
                checkedChildren={<ExperimentOutlined />}
                unCheckedChildren={<ApartmentOutlined />}
              />
              <span>Enhanced Mode</span>
              
              <Switch
                checked={useHierarchicalMode}
                onChange={setUseHierarchicalMode}
                checkedChildren={<BranchesOutlined />}
                unCheckedChildren="Hierarchical"
              />
              <span>Hierarchical Mode</span>
            </Space>
          </Card>

          {/* 그래프 렌더링 */}
          {useHierarchicalMode ? (
            <HierarchicalNetworkGraph
              data={graphData}
              onNodeClick={(nodeId) => {
                console.log('Hierarchical mode - Clicked node:', nodeId)
                message.info(`🎯 Selected: ${nodeId}`)
              }}
            />
          ) : useEnhancedMode ? (
            <EnhancedNetworkGraph
              data={graphData}
              onNodeClick={(nodeId) => {
                console.log('Enhanced mode - Clicked node:', nodeId)
                message.info(`🎯 Selected: ${nodeId}`)
              }}
            />
          ) : (
            <NetworkGraph2D
              data={graphData}
              onNodeClick={(node) => {
                message.info(`Selected: ${node.name} (${node.type})`)
              }}
            />
          )}
        </Col>
      </Row>
    </div>
  )
}

export default VisualizationPage