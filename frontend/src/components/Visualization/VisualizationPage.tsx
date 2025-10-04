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
  const [loadingDetails, setLoadingDetails] = useState<string>('')
  const [processingStats, setProcessingStats] = useState<{
    totalItems: number
    processedItems: number
    currentType: string
  }>({ totalItems: 0, processedItems: 0, currentType: '' })
  
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

        const transformedData = await transformAnalysisToGraphAsync(results, (progress: number, stage: string, details?: string, stats?: { totalItems: number, processedItems: number, currentType: string }) => {
          if (isMounted) {
            setLoadingProgress(15 + progress * 80) // 15% ~ 95%
            setLoadingStage(stage)
            if (details) setLoadingDetails(details)
            if (stats) setProcessingStats(stats)
          }
        })
        
        if (!isMounted || abortController.signal.aborted) return;

        // Start final rendering phase
        setLoadingProgress(95)
        setLoadingStage('Rendering graph visualization...')
        setLoadingDetails('Preparing visual elements and layout...')
        setProcessingStats({ totalItems: 0, processedItems: 0, currentType: '' })

        setGraphData(transformedData)

        // Simulate graph rendering time for better UX
        await new Promise(resolve => setTimeout(resolve, 500))

        if (!isMounted || abortController.signal.aborted) return;

        setLoadingProgress(100)
        setLoadingStage('Visualization ready!')
        setLoadingDetails('Graph successfully rendered')

        // Clear loading states after a brief display
        setTimeout(() => {
          if (isMounted) {
            setLoadingDetails('')
            setProcessingStats({ totalItems: 0, processedItems: 0, currentType: '' })
          }
        }, 1000)
        
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
    onProgress?: (progress: number, stage: string, details?: string, stats?: { totalItems: number, processedItems: number, currentType: string }) => void
  ): Promise<GraphData> => {
    const nodes: GraphData['nodes'] = []
    const edges: GraphData['edges'] = []

    console.log('Transforming analysis results (async):', analysisResults)

    // Get dependency graph data
    const asyncDependencyGraph = analysisResults.dependency_graph || {}

    // Calculate total items for accurate progress tracking
    const totalCounts = {
      packages: asyncDependencyGraph.packages?.length || 0,
      modules: asyncDependencyGraph.modules?.length || 0,
      classes: asyncDependencyGraph.classes?.length || 0,
      methods: asyncDependencyGraph.methods?.length || 0,
      fields: asyncDependencyGraph.fields?.length || 0
    }
    const totalItems = Object.values(totalCounts).reduce((sum, count) => sum + count, 0)

    console.log('📊 Total items to process:', totalCounts, '(Total:', totalItems, ')')

    // 🚀 성능 최적화: 더 큰 청크 크기로 배치 처리 효율성 증대
    const CHUNK_SIZE = 500; // Process in larger chunks for better performance
    let processedItems = 0

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
          processedItems++
        })

        // Update progress with detailed info
        const progress = Math.min(processedItems / totalItems, 0.3) // Packages take up to 30% of total progress
        onProgress?.(
          progress,
          'Processing packages...',
          `Building package hierarchy (${Math.min(i + CHUNK_SIZE, packages.length)}/${packages.length})`,
          {
            totalItems: packages.length,
            processedItems: Math.min(i + CHUNK_SIZE, packages.length),
            currentType: 'Packages'
          }
        )

        // 🚀 최적화된 yield 빈도 (더 적은 빈도로 더 나은 성능)
        if (i % CHUNK_SIZE === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
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
          processedItems++
        })

        // Update progress with detailed info
        const progress = Math.min(processedItems / totalItems, 0.5) // Modules take up to 50% of total progress
        onProgress?.(
          progress,
          'Processing modules...',
          `Building module structure (${Math.min(i + CHUNK_SIZE, modules.length)}/${modules.length})`,
          {
            totalItems: modules.length,
            processedItems: Math.min(i + CHUNK_SIZE, modules.length),
            currentType: 'Modules'
          }
        )

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
          processedItems++
        })

        // Update progress with detailed info
        const progress = Math.min(processedItems / totalItems, 0.7) // Classes take up to 70% of total progress
        onProgress?.(
          progress,
          'Processing classes...',
          `Building class hierarchy (${Math.min(i + CHUNK_SIZE, classes.length)}/${classes.length})`,
          {
            totalItems: classes.length,
            processedItems: Math.min(i + CHUNK_SIZE, classes.length),
            currentType: 'Classes'
          }
        )

        // 🚀 클래스는 더 무거우므로 약간 더 자주 yield
        if (i % CHUNK_SIZE === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2))
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
          processedItems++
        })

        // Update progress with detailed info
        const progress = Math.min(processedItems / totalItems, 0.85) // Methods take up to 85% of total progress
        onProgress?.(
          progress,
          'Processing methods...',
          `Building method structure (${Math.min(i + CHUNK_SIZE, methods.length)}/${methods.length})`,
          {
            totalItems: methods.length,
            processedItems: Math.min(i + CHUNK_SIZE, methods.length),
            currentType: 'Methods'
          }
        )

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
          processedItems++
        })

        // Update progress with detailed info
        const progress = Math.min(processedItems / totalItems, 0.9) // Fields take up to 90% of total progress
        onProgress?.(
          progress,
          'Processing fields...',
          `Building field structure (${Math.min(i + CHUNK_SIZE, fields.length)}/${fields.length})`,
          {
            totalItems: fields.length,
            processedItems: Math.min(i + CHUNK_SIZE, fields.length),
            currentType: 'Fields'
          }
        )

        if (i % (CHUNK_SIZE * 2) === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
    }

    // Extract relationships from module imports and class relationships
    console.log('Extracting relationships from dependency graph...')
    onProgress?.(
      0.9,
      'Building relationships...',
      'Creating dependency connections between nodes',
      { totalItems: 0, processedItems: 0, currentType: 'Relationships' }
    )

    const nodeIds = new Set(nodes.map(n => n.id))
    let validEdges = 0
    let invalidEdges = 0

    // 🚀 성능 최적화: Set을 사용한 O(1) 엣지 중복 검사
    const edgeSet = new Set<string>()
    const addEdgeIfNotExists = (source: string, target: string, type: string) => {
      const edgeKey = `${source}->${target}`
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey)
        edges.push({ source, target, type })
        validEdges++
        return true
      }
      return false
    }

    // 🚀 성능 최적화: Map을 사용한 O(1) 노드 검색
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const nodeNameMap = new Map(nodes.map(n => [n.name, n]))

    // Calculate total relationships to process
    const moduleCount = asyncDependencyGraph.modules?.length || 0
    const classCount = asyncDependencyGraph.classes?.length || 0
    const totalRelationships = moduleCount + classCount
    let processedRelationships = 0
    
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
              // 🚀 최적화된 타겟 노드 검색
              const targetModule = imp.module
              let targetId = null

              if (targetModule) {
                // 1. 직접 ID로 검색 (가장 빠름)
                if (nodeMap.has(targetModule)) {
                  targetId = targetModule
                }
                // 2. 이름으로 검색
                else if (nodeNameMap.has(targetModule)) {
                  targetId = nodeNameMap.get(targetModule)!.id
                }
                // 3. mod: 프리픽스 시도
                else {
                  const modPrefixed = `mod:${targetModule}`
                  if (nodeIds.has(modPrefixed)) {
                    targetId = modPrefixed
                  }
                }
              }

              // 🚀 최적화된 엣지 생성 (중복 검사 O(1))
              if (targetId && sourceId !== targetId && nodeIds.has(sourceId)) {
                addEdgeIfNotExists(sourceId, targetId, imp.import_type || 'import')
              } else {
                invalidEdges++
              }
            })
          }

          // Create edges from module to its classes
          if (mod.classes && Array.isArray(mod.classes)) {
            mod.classes.forEach((classId: string) => {
              if (nodeIds.has(classId) && sourceId !== classId) {
                addEdgeIfNotExists(sourceId, classId, 'contains')
              }
            })
          }
          processedRelationships++
        })

        // Update progress during edge creation
        const relationshipProgress = processedRelationships / totalRelationships
        const progress = 0.9 + relationshipProgress * 0.08 // 90% - 98%
        onProgress?.(
          progress,
          'Building relationships...',
          `Creating module dependencies (${Math.min(i + CHUNK_SIZE, modules.length)}/${modules.length})`,
          {
            totalItems: modules.length,
            processedItems: Math.min(i + CHUNK_SIZE, modules.length),
            currentType: 'Module edges'
          }
        )

        // 🚀 최적화된 yield 빈도 (더 적은 빈도로 더 나은 성능)
        if (i % CHUNK_SIZE === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
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

          // 🚀 최적화된 클래스-메서드 관계 생성
          if (cls.methods && Array.isArray(cls.methods)) {
            cls.methods.forEach((methodId: string) => {
              if (nodeIds.has(methodId) && sourceId !== methodId) {
                addEdgeIfNotExists(sourceId, methodId, 'contains')
              }
            })
          }

          // 🚀 최적화된 클래스-필드 관계 생성
          if (cls.fields && Array.isArray(cls.fields)) {
            cls.fields.forEach((fieldId: string) => {
              if (nodeIds.has(fieldId) && sourceId !== fieldId) {
                addEdgeIfNotExists(sourceId, fieldId, 'contains')
              }
            })
          }
          processedRelationships++
        })

        // Update progress during class edge creation
        const relationshipProgress = processedRelationships / totalRelationships
        const progress = 0.9 + relationshipProgress * 0.08 // 90% - 98%
        onProgress?.(
          progress,
          'Building relationships...',
          `Creating class hierarchies (${Math.min(i + CHUNK_SIZE, classes.length)}/${classes.length})`,
          {
            totalItems: classes.length,
            processedItems: Math.min(i + CHUNK_SIZE, classes.length),
            currentType: 'Class edges'
          }
        )

        // 🚀 최적화된 yield 빈도 (더 적은 빈도로 더 나은 성능)
        if (i % CHUNK_SIZE === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      }
    }
    
    console.log(`All relationships extracted: ${validEdges} valid, ${invalidEdges} invalid`)
    console.log(`Sample edges:`, edges.slice(0, 5))

    // Final processing step
    onProgress?.(
      0.98,
      'Finalizing graph...',
      `Completed processing ${nodes.length} nodes and ${edges.length} edges`,
      {
        totalItems: nodes.length + edges.length,
        processedItems: nodes.length + edges.length,
        currentType: 'Finalization'
      }
    )

    console.log(`Final async graph data: ${nodes.length} nodes, ${edges.length} edges`)
    await new Promise(resolve => setTimeout(resolve, 100))
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

        {/* Main Loading Stage */}
        <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: '#1890ff' }}>
          {loadingStage || 'Loading visualization data...'}
        </div>

        {/* Progress Bar */}
        {loadingProgress > 0 && (
          <div style={{ maxWidth: 500, margin: '20px auto 0' }}>
            <Progress
              percent={Math.round(loadingProgress)}
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              format={(percent) => `${percent}%`}
            />
          </div>
        )}

        {/* Detailed Progress Info */}
        {loadingDetails && (
          <div style={{
            marginTop: 12,
            fontSize: 14,
            color: '#595959',
            fontWeight: 500
          }}>
            {loadingDetails}
          </div>
        )}

        {/* Processing Stats */}
        {processingStats.totalItems > 0 && (
          <div style={{
            marginTop: 8,
            fontSize: 12,
            color: '#8c8c8c',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16
          }}>
            <span>
              📊 {processingStats.currentType}: {processingStats.processedItems.toLocaleString()} / {processingStats.totalItems.toLocaleString()}
            </span>
            {processingStats.currentType && (
              <span>
                ⚡ {Math.round((processingStats.processedItems / processingStats.totalItems) * 100)}% complete
              </span>
            )}
          </div>
        )}

        {/* Processing Steps Indicator */}
        <div style={{
          marginTop: 24,
          maxWidth: 400,
          margin: '24px auto 0',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
            📋 Processing Steps:
          </div>
          <div style={{ fontSize: 11, color: '#bfbfbf', lineHeight: 1.6 }}>
            {loadingProgress < 10 && '🔄 Fetching analysis data...'}
            {loadingProgress >= 10 && loadingProgress < 20 && '✅ Analysis data loaded'}
            {loadingProgress >= 20 && loadingProgress < 40 && '🔄 Processing packages & modules...'}
            {loadingProgress >= 40 && loadingProgress < 60 && '🔄 Building class hierarchy...'}
            {loadingProgress >= 60 && loadingProgress < 80 && '🔄 Processing methods & fields...'}
            {loadingProgress >= 80 && loadingProgress < 95 && '🔄 Building relationships...'}
            {loadingProgress >= 95 && loadingProgress < 100 && '🔄 Rendering graph visualization...'}
            {loadingProgress >= 100 && '✅ Visualization ready!'}
          </div>
        </div>

        <div style={{ marginTop: 20, color: '#666', fontSize: 12 }}>
          💡 Large codebases may take longer to process. Please wait while we optimize the visualization for better performance.
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