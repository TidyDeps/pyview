// Visualization Page with Graph and Controls
import React, { useState, useEffect } from 'react'
import { Row, Col, message, Alert, Spin, Progress } from 'antd'
import { ApiService } from '@/services/api'
import HierarchicalNetworkGraph from './HierarchicalNetworkGraph'
import FileTreeSidebar from '../FileTree/FileTreeSidebar'

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
  const [loadingStage, setLoadingStage] = useState<string>('')
  const [loadingProgress, setLoadingProgress] = useState<number>(0)
  
  // Graph control states - only hierarchical mode
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [analysisResults, setAnalysisResults] = useState<any>(null)

  // Load analysis data
  useEffect(() => {
    if (!analysisId) return

    const loadAnalysisData = async () => {
      try {
        setLoading(true)
        setError(null)
        setLoadingStage('Fetching analysis results...')
        setLoadingProgress(10)
        
        const results = await ApiService.getAnalysisResults(analysisId)
        
        // Store raw analysis results for file tree
        setAnalysisResults(results)
        setLoadingProgress(30)
        
        // Transform backend data to graph format with progress
        setLoadingStage('Processing graph data...')
        setLoadingProgress(50)
        
        // Use setTimeout to allow UI to update before heavy computation
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const transformedData = await transformAnalysisToGraphAsync(results)
        setGraphData(transformedData)
        
        setLoadingProgress(100)
        setLoadingStage('Complete')
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load analysis data'
        setError(errorMessage)
        message.error(errorMessage)
      } finally {
        setLoading(false)
        setLoadingStage('')
        setLoadingProgress(0)
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
    const firstDependencyGraph = analysisResults.dependency_graph || {}
    
    // Extract nodes from different levels
    console.log('Processing nodes from dependency_graph...')
    if (firstDependencyGraph.packages) {
      console.log('Found packages:', firstDependencyGraph.packages.length)
      firstDependencyGraph.packages.forEach((pkg: any, index: number) => {
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

    if (firstDependencyGraph.modules) {
      console.log('Found modules:', firstDependencyGraph.modules.length)
      firstDependencyGraph.modules.forEach((mod: any, index: number) => {
        const angle = index * (Math.PI * 2) / firstDependencyGraph.modules.length
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

    if (firstDependencyGraph.classes) {
      firstDependencyGraph.classes.forEach((cls: any, index: number) => {
        const angle = index * (Math.PI * 2) / firstDependencyGraph.classes.length
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

    if (firstDependencyGraph.methods) {
      firstDependencyGraph.methods.forEach((method: any, index: number) => {
        const angle = index * (Math.PI * 2) / firstDependencyGraph.methods.length
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

    if (firstDependencyGraph.fields) {
      firstDependencyGraph.fields.forEach((field: any, index: number) => {
        const angle = index * (Math.PI * 2) / firstDependencyGraph.fields.length
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

    // Extract relationships from module imports and class relationships  
    console.log('Extracting relationships from dependency graph...')
    const syncDependencyGraph = analysisResults.dependency_graph || {}
    
    const nodeIdSet = new Set(nodes.map(n => n.id))
    let validEdges = 0
    let invalidEdges = 0
    
    // Extract edges from module imports
    if (syncDependencyGraph.modules) {
      const modules = syncDependencyGraph.modules
      console.log(`Extracting edges from ${modules.length} modules`)
      
      modules.forEach((mod: any) => {
        const sourceId = mod.id
        
        // Create edges from imports
        if (mod.imports && Array.isArray(mod.imports)) {
          mod.imports.forEach((imp: any) => {
            // Create target ID based on import
            const targetModule = imp.module
            let targetId = null
            
            // Try to find matching target node
            if (targetModule) {
              // Look for exact module match
              targetId = nodes.find(n => 
                n.id.includes(targetModule) || 
                n.name === targetModule ||
                (n.type === 'module' && n.id.endsWith(`:${targetModule}`))
              )?.id
              
              // If exact match not found, try with mod: prefix
              if (!targetId) {
                targetId = `mod:${targetModule}`
                if (!nodeIdSet.has(targetId)) {
                  targetId = null
                }
              }
            }
            
            // Create edge if valid target found
            if (targetId && sourceId !== targetId && nodeIdSet.has(sourceId)) {
              const edgeExists = edges.some(e => e.source === sourceId && e.target === targetId)
              if (!edgeExists) {
                edges.push({
                  source: sourceId,
                  target: targetId,
                  type: imp.import_type || 'import'
                })
                validEdges++
              }
            } else {
              invalidEdges++
            }
          })
        }
        
        // Create edges from module to its classes
        if (mod.classes && Array.isArray(mod.classes)) {
          mod.classes.forEach((classId: string) => {
            if (nodeIdSet.has(classId) && sourceId !== classId) {
              const edgeExists = edges.some(e => e.source === sourceId && e.target === classId)
              if (!edgeExists) {
                edges.push({
                  source: sourceId,
                  target: classId,
                  type: 'contains'
                })
                validEdges++
              }
            }
          })
        }
      })
    }
    
    // Extract edges from class methods and fields
    if (syncDependencyGraph.classes) {
      const classes = syncDependencyGraph.classes
      console.log(`Extracting edges from ${classes.length} classes`)
      
      classes.forEach((cls: any) => {
        const sourceId = cls.id
        
        // Create edges from class to its methods
        if (cls.methods && Array.isArray(cls.methods)) {
          cls.methods.forEach((methodId: string) => {
            if (nodeIdSet.has(methodId) && sourceId !== methodId) {
              const edgeExists = edges.some(e => e.source === sourceId && e.target === methodId)
              if (!edgeExists) {
                edges.push({
                  source: sourceId,
                  target: methodId,
                  type: 'contains'
                })
                validEdges++
              }
            }
          })
        }
        
        // Create edges from class to its fields
        if (cls.fields && Array.isArray(cls.fields)) {
          cls.fields.forEach((fieldId: string) => {
            if (nodeIdSet.has(fieldId) && sourceId !== fieldId) {
              const edgeExists = edges.some(e => e.source === sourceId && e.target === fieldId)
              if (!edgeExists) {
                edges.push({
                  source: sourceId,
                  target: fieldId,
                  type: 'contains'
                })
                validEdges++
              }
            }
          })
        }
      })
    }
    
    console.log(`All relationships extracted: ${validEdges} valid, ${invalidEdges} invalid`)
    console.log(`Sample edges:`, edges.slice(0, 5))

    console.log(`Final graph data: ${nodes.length} nodes, ${edges.length} edges`)
    return { nodes, edges }
  }

  // Async version with progress updates and data limiting
  const transformAnalysisToGraphAsync = async (analysisResults: any): Promise<GraphData> => {
    const nodes: GraphData['nodes'] = []
    const edges: GraphData['edges'] = []

    console.log('Transforming analysis results (async):', analysisResults)
    
    // Get dependency graph data
    const asyncDependencyGraph = analysisResults.dependency_graph || {}
    
    // Process all data but with chunking for performance
    const CHUNK_SIZE = 100; // Process in chunks to avoid blocking UI

    // Process packages (all data)
    if (asyncDependencyGraph.packages) {
      const packages = asyncDependencyGraph.packages
      console.log(`Processing ${packages.length} packages`)
      
      for (let i = 0; i < packages.length; i += CHUNK_SIZE) {
        const chunk = packages.slice(i, i + CHUNK_SIZE)
        
        chunk.forEach((pkg: any, chunkIndex: number) => {
          const index = i + chunkIndex
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
        })
        
        // Yield control after each chunk
        if (i % (CHUNK_SIZE * 2) === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
    }

    // Process modules (all data)
    if (asyncDependencyGraph.modules) {
      const modules = asyncDependencyGraph.modules
      console.log(`Processing ${modules.length} modules`)
      
      for (let i = 0; i < modules.length; i += CHUNK_SIZE) {
        const chunk = modules.slice(i, i + CHUNK_SIZE)
        
        chunk.forEach((mod: any, chunkIndex: number) => {
          const index = i + chunkIndex
          const angle = index * (Math.PI * 2) / modules.length
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
        })
        
        if (i % (CHUNK_SIZE * 2) === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
    }

    // Process classes (all data - most performance critical)
    if (asyncDependencyGraph.classes) {
      const classes = asyncDependencyGraph.classes
      console.log(`Processing ${classes.length} classes`)
      
      for (let i = 0; i < classes.length; i += CHUNK_SIZE) {
        const chunk = classes.slice(i, i + CHUNK_SIZE)
        
        chunk.forEach((cls: any, chunkIndex: number) => {
          const index = i + chunkIndex
          const angle = index * (Math.PI * 2) / classes.length
          const radius = 35 + (index % 2) * 10
          const height = 15 + (index % 3) * 8
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
        
        // More frequent yields for classes (heavy processing)
        if (i % CHUNK_SIZE === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    }

    // Process methods (all data)
    if (asyncDependencyGraph.methods) {
      const methods = asyncDependencyGraph.methods
      console.log(`Processing ${methods.length} methods`)
      
      for (let i = 0; i < methods.length; i += CHUNK_SIZE) {
        const chunk = methods.slice(i, i + CHUNK_SIZE)
        
        chunk.forEach((method: any, chunkIndex: number) => {
          const index = i + chunkIndex
          const angle = index * (Math.PI * 2) / methods.length
          const radius = 20 + (index % 4) * 5
          const height = 30 + (index % 3) * 12
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
        
        if (i % (CHUNK_SIZE * 2) === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
    }

    // Process fields (all data)
    if (asyncDependencyGraph.fields) {
      const fields = asyncDependencyGraph.fields
      console.log(`Processing ${fields.length} fields`)
      
      for (let i = 0; i < fields.length; i += CHUNK_SIZE) {
        const chunk = fields.slice(i, i + CHUNK_SIZE)
        
        chunk.forEach((field: any, chunkIndex: number) => {
          const index = i + chunkIndex
          const angle = index * (Math.PI * 2) / fields.length
          const radius = 25 + (index % 3) * 8
          const height = -20 + (index % 2) * 10
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
        
        if (i % (CHUNK_SIZE * 2) === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
    }

    // Extract relationships from module imports and class relationships
    console.log('Extracting relationships from dependency graph...')
    
    const nodeIds = new Set(nodes.map(n => n.id))
    let validEdges = 0
    let invalidEdges = 0
    
    // Extract edges from module imports
    if (asyncDependencyGraph.modules) {
      const modules = asyncDependencyGraph.modules
      console.log(`Extracting edges from ${modules.length} modules`)
      
      for (let i = 0; i < modules.length; i += CHUNK_SIZE) {
        const chunk = modules.slice(i, i + CHUNK_SIZE)
        
        chunk.forEach((mod: any) => {
          const sourceId = mod.id
          
          // Create edges from imports
          if (mod.imports && Array.isArray(mod.imports)) {
            mod.imports.forEach((imp: any) => {
              // Create target ID based on import
              const targetModule = imp.module
              let targetId = null
              
              // Try to find matching target node
              if (targetModule) {
                // Look for exact module match
                targetId = nodes.find(n => 
                  n.id.includes(targetModule) || 
                  n.name === targetModule ||
                  (n.type === 'module' && n.id.endsWith(`:${targetModule}`))
                )?.id
                
                // If exact match not found, try with mod: prefix
                if (!targetId) {
                  targetId = `mod:${targetModule}`
                  if (!nodeIds.has(targetId)) {
                    targetId = null
                  }
                }
              }
              
              // Create edge if valid target found
              if (targetId && sourceId !== targetId && nodeIds.has(sourceId)) {
                const edgeExists = edges.some(e => e.source === sourceId && e.target === targetId)
                if (!edgeExists) {
                  edges.push({
                    source: sourceId,
                    target: targetId,
                    type: imp.import_type || 'import'
                  })
                  validEdges++
                }
              } else {
                invalidEdges++
              }
            })
          }
          
          // Create edges from module to its classes
          if (mod.classes && Array.isArray(mod.classes)) {
            mod.classes.forEach((classId: string) => {
              if (nodeIds.has(classId) && sourceId !== classId) {
                const edgeExists = edges.some(e => e.source === sourceId && e.target === classId)
                if (!edgeExists) {
                  edges.push({
                    source: sourceId,
                    target: classId,
                    type: 'contains'
                  })
                  validEdges++
                }
              }
            })
          }
        })
        
        // Yield control after each chunk
        if (i % (CHUNK_SIZE * 2) === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
    }
    
    // Extract edges from class methods and fields
    if (asyncDependencyGraph.classes) {
      const classes = asyncDependencyGraph.classes
      console.log(`Extracting edges from ${classes.length} classes`)
      
      for (let i = 0; i < classes.length; i += CHUNK_SIZE) {
        const chunk = classes.slice(i, i + CHUNK_SIZE)
        
        chunk.forEach((cls: any) => {
          const sourceId = cls.id
          
          // Create edges from class to its methods
          if (cls.methods && Array.isArray(cls.methods)) {
            cls.methods.forEach((methodId: string) => {
              if (nodeIds.has(methodId) && sourceId !== methodId) {
                const edgeExists = edges.some(e => e.source === sourceId && e.target === methodId)
                if (!edgeExists) {
                  edges.push({
                    source: sourceId,
                    target: methodId,
                    type: 'contains'
                  })
                  validEdges++
                }
              }
            })
          }
          
          // Create edges from class to its fields
          if (cls.fields && Array.isArray(cls.fields)) {
            cls.fields.forEach((fieldId: string) => {
              if (nodeIds.has(fieldId) && sourceId !== fieldId) {
                const edgeExists = edges.some(e => e.source === sourceId && e.target === fieldId)
                if (!edgeExists) {
                  edges.push({
                    source: sourceId,
                    target: fieldId,
                    type: 'contains'
                  })
                  validEdges++
                }
              }
            })
          }
        })
        
        // Yield control after each chunk
        if (i % (CHUNK_SIZE * 2) === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
    }
    
    console.log(`All relationships extracted: ${validEdges} valid, ${invalidEdges} invalid`)
    console.log(`Sample edges:`, edges.slice(0, 5))

    console.log(`Final async graph data: ${nodes.length} nodes, ${edges.length} edges`)
    return { nodes, edges }
  }



  // File tree node selection handler
  const handleFileTreeNodeSelect = (nodeId: string, nodeType: string) => {
    console.log('File tree selected:', nodeId, nodeType)
    setSelectedNodeId(nodeId)
    message.info(`📂 Selected from file tree: ${nodeId}`)
  }

  // Graph node click handler
  const handleGraphNodeClick = (nodeId: string) => {
    console.log('Graph node clicked:', nodeId)
    setSelectedNodeId(nodeId)
    message.info(`🎯 Selected from graph: ${nodeId}`)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 500 }}>
          {loadingStage || 'Loading visualization data...'}
        </div>
        {loadingProgress > 0 && (
          <div style={{ maxWidth: 400, margin: '20px auto 0' }}>
            <Progress 
              percent={loadingProgress} 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>
        )}
        <div style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
          💡 Processing large datasets may take a moment. The graph will render with optimized data for better performance.
        </div>
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

      <Row gutter={[16, 16]}>
        {/* File Tree Column - 조건부 렌더링 */}
        {analysisResults && (
          <Col xs={24} sm={6} md={6} lg={5}>
            <FileTreeSidebar
              analysisData={analysisResults}
              onNodeSelect={handleFileTreeNodeSelect}
              selectedNodeId={selectedNodeId || undefined}
              style={{ height: 'calc(100vh - 200px)' }}
            />
          </Col>
        )}
        
        {/* Graph Column */}
        <Col xs={24} sm={analysisResults ? 18 : 24} md={analysisResults ? 18 : 24} lg={analysisResults ? 19 : 24}>
          {/* 계층형 네트워크 그래프 */}
          <HierarchicalNetworkGraph
            data={graphData || undefined}
            onNodeClick={handleGraphNodeClick}
            selectedNodeId={selectedNodeId || undefined}
          />
        </Col>
      </Row>
    </div>
  )
}

export default VisualizationPage