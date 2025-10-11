// 간소화된 분석 데이터 → 그래프 변환 함수
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
    type: 'import' | 'inheritance' | 'composition' | 'call' | 'reference' | 'contains'
  }>
}

export const transformAnalysisToGraph = async (
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
  const CHUNK_SIZE = 500 // Process in larger chunks for better performance
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
        '패키지를 처리하고 있습니다...',
        `패키지 계층 구조 구성 중 (${Math.min(i + CHUNK_SIZE, packages.length)}/${packages.length})`,
        {
          totalItems: packages.length,
          processedItems: Math.min(i + CHUNK_SIZE, packages.length),
          currentType: 'Package'
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
        '모듈을 처리하고 있습니다...',
        `모듈 구조 구성 중 (${Math.min(i + CHUNK_SIZE, modules.length)}/${modules.length})`,
        {
          totalItems: modules.length,
          processedItems: Math.min(i + CHUNK_SIZE, modules.length),
          currentType: 'Module'
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
        '클래스를 처리하고 있습니다...',
        `클래스 계층 구조 구성 중 (${Math.min(i + CHUNK_SIZE, classes.length)}/${classes.length})`,
        {
          totalItems: classes.length,
          processedItems: Math.min(i + CHUNK_SIZE, classes.length),
          currentType: 'Class'
        }
      )

      // 🚀 클래스는 더 무거우므로 약간 더 자주 yield
      if (i % CHUNK_SIZE === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2))
      }
    }
  }

  // Process methods (all data) - 간단한 forEach 방식
  if (asyncDependencyGraph.methods) {
    const methods = asyncDependencyGraph.methods
    console.log(`Processing ${methods.length} methods`)

    methods.forEach((method: any, index: number) => {
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

    // 간단한 진행률 업데이트
    const progress = Math.min(processedItems / totalItems, 0.85)
    onProgress?.(
      progress,
      '메서드를 처리하고 있습니다...',
      `메서드 구조 구성 완료 (${methods.length}개)`,
      {
        totalItems: methods.length,
        processedItems: methods.length,
        currentType: 'Method'
      }
    )
  }

  // Process fields (all data) - 간단한 forEach 방식
  if (asyncDependencyGraph.fields) {
    const fields = asyncDependencyGraph.fields
    console.log(`Processing ${fields.length} fields`)

    fields.forEach((field: any, index: number) => {
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

    // 간단한 진행률 업데이트
    const progress = Math.min(processedItems / totalItems, 0.9)
    onProgress?.(
      progress,
      '필드를 처리하고 있습니다...',
      `필드 구조 구성 완료 (${fields.length}개)`,
      {
        totalItems: fields.length,
        processedItems: fields.length,
        currentType: 'Field'
      }
    )
  }

  // Extract relationships from module imports and class relationships
  console.log('Extracting relationships from dependency graph...')
  onProgress?.(
    0.9,
    '관계를 구성하고 있습니다...',
    '노드 간 의존성 연결을 생성하고 있습니다',
    { totalItems: 0, processedItems: 0, currentType: '관계' }
  )

  const nodeIds = new Set(nodes.map(n => n.id))
  let validEdges = 0
  let invalidEdges = 0

  // 단순하고 직관적인 엣지 중복 검사 함수
  const addEdgeIfNotExists = (source: string, target: string, type: 'import' | 'inheritance' | 'composition' | 'call' | 'reference' | 'contains') => {
    const edgeExists = edges.some(e => e.source === source && e.target === target)
    if (!edgeExists) {
      edges.push({ source, target, type })
      validEdges++
    }
  }

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
              // 검증된 단순하고 직관적인 모듈 매칭 로직 (VisualizationPage에서 잘 작동하던 방식)
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

            // 검증된 단순하고 안정적인 엣지 생성 로직
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

        // Create edges from module to its functions (module-level functions)
        if (mod.functions && Array.isArray(mod.functions)) {
          mod.functions.forEach((functionId: string) => {
            if (nodeIds.has(functionId) && sourceId !== functionId) {
              addEdgeIfNotExists(sourceId, functionId, 'contains')
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
        '관계를 구성하고 있습니다...',
        `모듈 의존성 생성 중 (${Math.min(i + CHUNK_SIZE, modules.length)}/${modules.length})`,
        {
          totalItems: modules.length,
          processedItems: Math.min(i + CHUNK_SIZE, modules.length),
          currentType: 'Module Edge'
        }
      )

      // 🚀 최적화된 yield 빈도 (더 적은 빈도로 더 나은 성능)
      if (i % CHUNK_SIZE === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }
  }

  // Extract edges from methods and fields (both class methods and module functions)
  if (asyncDependencyGraph.methods) {
    const methods = asyncDependencyGraph.methods
    console.log(`Processing ${methods.length} methods/functions for relationships`)

    for (let i = 0; i < methods.length; i += CHUNK_SIZE) {
      const chunk = methods.slice(i, i + CHUNK_SIZE)

      chunk.forEach((method: any) => {
        const methodId = method.id
        const classId = method.class_id
        const moduleId = method.module_id

        // Connect method to its parent (class or module)
        if (classId && nodeIds.has(classId) && nodeIds.has(methodId)) {
          // This is a class method
          addEdgeIfNotExists(classId, methodId, 'contains')
        } else if (moduleId && nodeIds.has(moduleId) && nodeIds.has(methodId)) {
          // This is a module-level function
          addEdgeIfNotExists(moduleId, methodId, 'contains')
        }
      })

      // Update progress
      const progress = 0.9 + (i / methods.length) * 0.08 // 90% - 98%
      onProgress?.(
        progress,
        '관계를 구성하고 있습니다...',
        `메서드/함수 관계 생성 중 (${Math.min(i + CHUNK_SIZE, methods.length)}/${methods.length})`,
        {
          totalItems: methods.length,
          processedItems: Math.min(i + CHUNK_SIZE, methods.length),
          currentType: 'Method/Function Edge'
        }
      )

      if (i % CHUNK_SIZE === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }
  }

  // Extract edges from class methods and fields (legacy - keeping for compatibility)
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
        '관계를 구성하고 있습니다...',
        `클래스 계층 생성 중 (${Math.min(i + CHUNK_SIZE, classes.length)}/${classes.length})`,
        {
          totalItems: classes.length,
          processedItems: Math.min(i + CHUNK_SIZE, classes.length),
          currentType: 'Class Edge'
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
    '그래프를 마무리하고 있습니다...',
    `${nodes.length}개 노드와 ${edges.length}개 엣지 처리 완료`,
    {
      totalItems: nodes.length + edges.length,
      processedItems: nodes.length + edges.length,
      currentType: '마무리'
    }
  )

  console.log(`Final async graph data: ${nodes.length} nodes, ${edges.length} edges`)
  await new Promise(resolve => setTimeout(resolve, 100))
  return { nodes, edges }
}