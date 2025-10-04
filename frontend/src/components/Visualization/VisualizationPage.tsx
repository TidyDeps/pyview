// 그래프와 컨트롤이 있는 시각화 페이지
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

  // 순환참조 데이터 추출 함수
  const extractCycleData = (analysisResults: any) => {
    if (!analysisResults || !analysisResults.cycles) {
      return { cycles: [] };
    }
    
    console.log('📊 Extracted cycle data:', analysisResults.cycles);
    return {
      cycles: analysisResults.cycles
    };
  };

  // Load analysis data
  useEffect(() => {
    if (!analysisId) return

    let isMounted = true;
    const abortController = new AbortController();

    const loadAnalysisData = async () => {
      try {
        if (isMounted) {
          setLoading(true)
          setError(null)
          setLoadingStage('Fetching analysis results...')
          setLoadingProgress(5)
        }

        const results = await ApiService.getAnalysisResults(analysisId)

        if (!isMounted || abortController.signal.aborted) return;

        // Log cycle data for debugging
        console.log('🔍 Analysis results received:', results)
        console.log('🔄 Cycle data in results:', results?.cycles)

        // Store raw analysis results for file tree
        setAnalysisResults(results)
        setLoadingProgress(10)

        // Transform backend data to graph format with progress
        setLoadingStage('Processing graph data...')
        setLoadingProgress(15)

        // Use setTimeout to allow UI to update before heavy computation
        await new Promise(resolve => setTimeout(resolve, 100))

        if (!isMounted || abortController.signal.aborted) return;

        const transformedData = await transformAnalysisToGraphAsync(results, (progress: number, stage: string) => {
          if (isMounted) {
            setLoadingProgress(15 + progress * 80) // 15% ~ 95%
            setLoadingStage(stage)
          }
        })
        
        if (!isMounted || abortController.signal.aborted) return;

        setGraphData(transformedData)
        setLoadingProgress(100)
        setLoadingStage('Complete')
        
      } catch (err) {
        if (isMounted && !abortController.signal.aborted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load analysis data'
          setError(errorMessage)
          message.error(errorMessage)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setLoadingStage('')
          setLoadingProgress(0)
        }
      }
    }

    loadAnalysisData()

    return () => {
      isMounted = false;
      abortController.abort();
    };
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
  const transformAnalysisToGraphAsync = async (
    analysisResults: any,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<GraphData> => {
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
      onProgress?.(0.1, 'Processing packages...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
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
      onProgress?.(0.4, 'Processing modules...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
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
      onProgress?.(0.7, 'Processing fields...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
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
    onProgress?.(0.8, 'Building relationships...')
    await new Promise(resolve => setTimeout(resolve, 300))
    
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
    onProgress?.(1.0, 'Finalizing graph...')
    await new Promise(resolve => setTimeout(resolve, 200))
    return { nodes, edges }
  }

  // Get node information from graph data
  const getNodeInfo = (nodeId: string): { type: string; name: string } => {
    console.log('🔍 getNodeInfo called with nodeId:', nodeId)

    // Try to find the node in graph data first
    if (graphData) {
      const node = graphData.nodes.find(n => n.id === nodeId)
      console.log('📊 Found node in graphData:', node)

      if (node) {
        const type = node.type.charAt(0).toUpperCase() + node.type.slice(1)
        const result = { type, name: node.name }
        console.log('✅ Returning from graphData:', result)
        return result
      }
    }

    // Fallback: parse from nodeId if not found in graph data
    console.log('⚠️ Node not found in graphData, using fallback parsing')

    // Remove common prefixes and parse
    let cleanNodeId = nodeId
    if (nodeId.startsWith('mod:')) {
      cleanNodeId = nodeId.replace('mod:', '')
      return { type: 'Module', name: cleanNodeId }
    } else if (nodeId.startsWith('cls:')) {
      cleanNodeId = nodeId.replace('cls:', '')
      return { type: 'Class', name: cleanNodeId }
    } else if (nodeId.startsWith('method:')) {
      cleanNodeId = nodeId.replace('method:', '')
      return { type: 'Method', name: cleanNodeId }
    } else if (nodeId.startsWith('field:')) {
      cleanNodeId = nodeId.replace('field:', '')
      return { type: 'Field', name: cleanNodeId }
    } else if (nodeId.includes('/')) {
      const name = nodeId.split('/').pop() || nodeId
      return { type: 'File', name }
    } else {
      return { type: 'Node', name: nodeId }
    }
  }

  // File tree node selection handler
  const handleFileTreeNodeSelect = (nodeId: string, nodeType: string) => {
    console.log('🌳 File tree selected:', nodeId, nodeType)
    setSelectedNodeId(nodeId)

    // Try to get info from graph data first, then fallback to nodeType
    const { type, name } = getNodeInfo(nodeId)

    // If getNodeInfo couldn't find it and we have nodeType, use that
    if (type === 'Node' && nodeType) {
      const parsedName = nodeId.includes('/') ? nodeId.split('/').pop() || nodeId : nodeId
      const parsedType = nodeType.charAt(0).toUpperCase() + nodeType.slice(1)
      console.log('🔄 Using nodeType fallback:', { type: parsedType, name: parsedName })
      message.info(`Selected ${parsedType}: ${parsedName}`)
    } else {
      console.log('✅ Using getNodeInfo result:', { type, name })
      message.info(`Selected ${type}: ${name}`)
    }
  }

  // Graph node click handler
  const handleGraphNodeClick = (nodeId: string) => {
    console.log('Graph node clicked:', nodeId)
    setSelectedNodeId(nodeId)

    const { type, name } = getNodeInfo(nodeId)
    message.info(`Selected ${type}: ${name}`)
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
              cycleData={extractCycleData(analysisResults)}
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
            cycleData={extractCycleData(analysisResults)}
            onNodeClick={handleGraphNodeClick}
            selectedNodeId={selectedNodeId || undefined}
          />
        </Col>
      </Row>
    </div>
  )
}

export default VisualizationPage