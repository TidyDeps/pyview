// File Tree Sidebar Component for IDE-like file navigation  
import React, { useState, useEffect, useMemo } from 'react'
import { Tree, Input, Card, Empty } from 'antd'
import { 
  FolderOutlined, 
  FolderOpenOutlined, 
  FileOutlined,
  FunctionOutlined,
  BlockOutlined,
  SearchOutlined,
  FieldBinaryOutlined,
  ExclamationCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import type { TreeProps } from 'antd/es/tree'

const { Search } = Input

interface FileTreeNode {
  key: string
  title: React.ReactNode
  children?: FileTreeNode[]
  entityType: 'package' | 'module' | 'class' | 'method' | 'field'
  searchText: string
  nodeId: string
  isLeaf?: boolean
  isInCycle?: boolean
  cycleSeverity?: 'low' | 'medium' | 'high'
}

interface FileTreeSidebarProps {
  analysisData?: any
  cycleData?: any // 순환 참조 데이터
  onNodeSelect?: (nodeId: string, nodeType: string) => void
  selectedNodeId?: string
  style?: React.CSSProperties
}

const FileTreeSidebar: React.FC<FileTreeSidebarProps> = ({
  analysisData,
  cycleData,
  onNodeSelect,
  selectedNodeId,
  style
}) => {
  const [searchValue, setSearchValue] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [autoExpandParent, setAutoExpandParent] = useState(true)

  // 순환 참조 정보 처리
  const cycleInfo = useMemo(() => {
    const cycleNodes = new Set<string>();
    const nodeSeverity = new Map<string, string>();

    if (cycleData && cycleData.cycles) {
      cycleData.cycles.forEach((cycle: any) => {
        const severity = cycle.severity || 'medium';
        cycle.entities.forEach((entity: string) => {
          cycleNodes.add(entity);
          nodeSeverity.set(entity, severity);
        });
      });
    }

    return { cycleNodes, nodeSeverity };
  }, [cycleData]);

  // 순환 참조 아이콘 렌더링
  const renderCycleIcon = (nodeId: string) => {
    if (!cycleInfo.cycleNodes.has(nodeId)) return null;
    
    const severity = cycleInfo.nodeSeverity.get(nodeId);
    const iconStyle = {
      marginLeft: 8,
      fontSize: '12px',
      color: severity === 'high' ? '#ff4d4f' : 
             severity === 'medium' ? '#fa8c16' : '#faad14'
    };
    
    return (
      <ExclamationCircleOutlined 
        style={iconStyle}
        title={`Circular dependency (${severity} severity)`}
      />
    );
  };

  // Build proper hierarchical tree structure
  const treeData = useMemo(() => {
    if (!analysisData) {
      console.log('FileTreeSidebar - No analysis data')
      return []
    }

    console.log('FileTreeSidebar - Analysis data:', analysisData)
    console.log('FileTreeSidebar - Dependency graph:', analysisData.dependency_graph)
    
    // Extract dependency graph from analysis data
    const dependencyGraph = analysisData.dependency_graph || {}
    
    // Create maps for quick lookup
    const packageMap = new Map()
    const moduleMap = new Map()
    const classMap = new Map()
    const methodMap = new Map()
    const fieldMap = new Map()

    // First, create all entities and populate maps
    if (dependencyGraph.packages) {
      console.log('FileTreeSidebar - Found packages:', dependencyGraph.packages.length)
      dependencyGraph.packages.forEach((pkg: any) => {
        const pkgId = pkg.id || pkg.package_id || pkg.name
        const packageNode: FileTreeNode = {
          key: `package_${pkgId}`,
          title: (
            <span>
              <FolderOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              {pkg.name || pkgId}
              {renderCycleIcon(pkgId)}
            </span>
          ),
          entityType: 'package',
          searchText: pkg.name || pkgId,
          nodeId: pkgId,
          children: [],
          isInCycle: cycleInfo.cycleNodes.has(pkgId),
          cycleSeverity: cycleInfo.nodeSeverity.get(pkgId) as any
        }
        packageMap.set(pkgId, packageNode)
      })
    }

    if (dependencyGraph.modules) {
      console.log('FileTreeSidebar - Found modules:', dependencyGraph.modules.length)
      dependencyGraph.modules.forEach((mod: any) => {
        const modId = mod.id || mod.module_id || mod.name
        const moduleNode: FileTreeNode = {
          key: `module_${modId}`,
          title: (
            <span>
              <FileOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              {mod.name || modId}
              {renderCycleIcon(modId)}
            </span>
          ),
          entityType: 'module',
          searchText: mod.name || modId,
          nodeId: modId,
          children: [],
          isInCycle: cycleInfo.cycleNodes.has(modId),
          cycleSeverity: cycleInfo.nodeSeverity.get(modId) as any
        }
        moduleMap.set(modId, moduleNode)
      })
    }

    if (dependencyGraph.classes) {
      console.log('FileTreeSidebar - Found classes:', dependencyGraph.classes.length)
      dependencyGraph.classes.forEach((cls: any) => {
        const clsId = cls.id || cls.class_id || cls.name
        const classNode: FileTreeNode = {
          key: `class_${clsId}`,
          title: (
            <span>
              <BlockOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
              {cls.name || clsId}
              {renderCycleIcon(clsId)}
            </span>
          ),
          entityType: 'class',
          searchText: cls.name || clsId,
          nodeId: clsId,
          children: [],
          isInCycle: cycleInfo.cycleNodes.has(clsId),
          cycleSeverity: cycleInfo.nodeSeverity.get(clsId) as any
        }
        classMap.set(clsId, classNode)
      })
    }

    if (dependencyGraph.methods) {
      console.log('FileTreeSidebar - Found methods:', dependencyGraph.methods.length)
      dependencyGraph.methods.forEach((method: any) => {
        const methodId = method.id || method.method_id || method.name
        const methodNode: FileTreeNode = {
          key: `method_${methodId}`,
          title: (
            <span>
              <FunctionOutlined style={{ marginRight: 8, color: '#eb2f96' }} />
              {method.name || methodId}
              {renderCycleIcon(methodId)}
            </span>
          ),
          entityType: 'method',
          searchText: method.name || methodId,
          nodeId: methodId,
          isLeaf: true,
          isInCycle: cycleInfo.cycleNodes.has(methodId),
          cycleSeverity: cycleInfo.nodeSeverity.get(methodId) as any
        }
        methodMap.set(methodId, methodNode)
      })
    }

    if (dependencyGraph.fields) {
      console.log('FileTreeSidebar - Found fields:', dependencyGraph.fields.length)
      dependencyGraph.fields.forEach((field: any) => {
        const fieldId = field.id || field.field_id || field.name
        const fieldNode: FileTreeNode = {
          key: `field_${fieldId}`,
          title: (
            <span>
              <FieldBinaryOutlined style={{ marginRight: 8, color: '#722ed1' }} />
              {field.name || fieldId}
              {renderCycleIcon(fieldId)}
            </span>
          ),
          entityType: 'field',
          searchText: field.name || fieldId,
          nodeId: fieldId,
          isLeaf: true,
          isInCycle: cycleInfo.cycleNodes.has(fieldId),
          cycleSeverity: cycleInfo.nodeSeverity.get(fieldId) as any
        }
        fieldMap.set(fieldId, fieldNode)
      })
    }

    // Build hierarchy using direct relationships from demo data structure
    // Package -> Module relationships (from demo data structure)
    if (dependencyGraph.packages) {
      dependencyGraph.packages.forEach((pkg: any) => {
        const pkgId = pkg.id || pkg.package_id || pkg.name
        const packageNode = packageMap.get(pkgId)
        
        if (packageNode && dependencyGraph.modules) {
          // Find modules that belong to this package by matching package_id
          dependencyGraph.modules.forEach((mod: any) => {
            if (mod.package_id === pkgId) {
              const modId = mod.id || mod.module_id || mod.name
              const moduleNode = moduleMap.get(modId)
              if (moduleNode) {
                packageNode.children!.push(moduleNode)
              }
            }
          })
        }
      })
    }

    // Module -> Class relationships (from demo data structure)
    if (dependencyGraph.classes) {
      dependencyGraph.classes.forEach((cls: any) => {
        const clsId = cls.id || cls.class_id || cls.name
        const classNode = classMap.get(clsId)
        
        if (classNode && cls.module_id) {
          const moduleNode = moduleMap.get(cls.module_id)
          if (moduleNode) {
            moduleNode.children!.push(classNode)
          }
        }
      })
    }

    // Class -> Method relationships (from demo data structure)
    if (dependencyGraph.methods) {
      dependencyGraph.methods.forEach((method: any) => {
        const methodId = method.id || method.method_id || method.name
        const methodNode = methodMap.get(methodId)
        
        if (methodNode && method.class_id) {
          const classNode = classMap.get(method.class_id)
          if (classNode) {
            classNode.children!.push(methodNode)
          }
        }
      })
    }

    // Class -> Field relationships (from demo data structure)
    if (dependencyGraph.fields) {
      dependencyGraph.fields.forEach((field: any) => {
        const fieldId = field.id || field.field_id || field.name
        const fieldNode = fieldMap.get(fieldId)
        
        if (fieldNode && field.class_id) {
          const classNode = classMap.get(field.class_id)
          if (classNode) {
            classNode.children!.push(fieldNode)
          }
        }
      })
    }

    // If no relationships exist, try to infer hierarchy from naming conventions
    if (!analysisData.relationships || analysisData.relationships.length === 0) {
      console.log('No relationships found, attempting to infer hierarchy from names')
      
      // Try to match modules to packages based on name prefixes
      moduleMap.forEach((moduleNode, moduleId) => {
        const moduleName = moduleNode.searchText
        let bestMatch = null
        let bestMatchLength = 0
        
        packageMap.forEach((packageNode, packageId) => {
          const packageName = packageNode.searchText
          if (moduleName.startsWith(packageName) && packageName.length > bestMatchLength) {
            bestMatch = packageNode
            bestMatchLength = packageName.length
          }
        })
        
        if (bestMatch) {
          bestMatch.children!.push(moduleNode)
        }
      })

      // Try to match classes to modules based on name prefixes
      classMap.forEach((classNode, classId) => {
        const className = classNode.searchText
        let bestMatch = null
        let bestMatchLength = 0
        
        moduleMap.forEach((moduleNode, moduleId) => {
          const moduleName = moduleNode.searchText
          if (className.startsWith(moduleName) && moduleName.length > bestMatchLength) {
            bestMatch = moduleNode
            bestMatchLength = moduleName.length
          }
        })
        
        if (bestMatch) {
          bestMatch.children!.push(classNode)
        }
      })

      // Try to match methods to classes based on name prefixes
      methodMap.forEach((methodNode, methodId) => {
        const methodName = methodNode.searchText
        let bestMatch = null
        let bestMatchLength = 0
        
        classMap.forEach((classNode, classId) => {
          const className = classNode.searchText
          if (methodName.startsWith(className) && className.length > bestMatchLength) {
            bestMatch = classNode
            bestMatchLength = className.length
          }
        })
        
        if (bestMatch) {
          bestMatch.children!.push(methodNode)
        }
      })

      // Try to match fields to classes based on name prefixes
      fieldMap.forEach((fieldNode, fieldId) => {
        const fieldName = fieldNode.searchText
        let bestMatch = null
        let bestMatchLength = 0
        
        classMap.forEach((classNode, classId) => {
          const className = classNode.searchText
          if (fieldName.startsWith(className) && className.length > bestMatchLength) {
            bestMatch = classNode
            bestMatchLength = className.length
          }
        })
        
        if (bestMatch) {
          bestMatch.children!.push(fieldNode)
        }
      })
    }

    // Build final tree starting from packages (top-level)
    const rootNodes: FileTreeNode[] = []

    // Add packages that have children or are root level
    packageMap.forEach((packageNode) => {
      rootNodes.push(packageNode)
    })

    // Add orphaned modules (modules not contained in any package)
    moduleMap.forEach((moduleNode) => {
      let isOrphaned = true
      packageMap.forEach((packageNode) => {
        if (packageNode.children!.some(child => child.nodeId === moduleNode.nodeId)) {
          isOrphaned = false
        }
      })
      if (isOrphaned) {
        rootNodes.push(moduleNode)
      }
    })

    // Add orphaned classes (classes not contained in any module)
    classMap.forEach((classNode) => {
      let isOrphaned = true
      moduleMap.forEach((moduleNode) => {
        if (moduleNode.children!.some(child => child.nodeId === classNode.nodeId)) {
          isOrphaned = false
        }
      })
      packageMap.forEach((packageNode) => {
        if (packageNode.children!.some(child => child.nodeId === classNode.nodeId)) {
          isOrphaned = false
        }
      })
      if (isOrphaned) {
        rootNodes.push(classNode)
      }
    })

    // Add orphaned methods and fields (not contained in any class)
    methodMap.forEach((methodNode) => {
      let isOrphaned = true
      classMap.forEach((classNode) => {
        if (classNode.children!.some(child => child.nodeId === methodNode.nodeId)) {
          isOrphaned = false
        }
      })
      if (isOrphaned) {
        rootNodes.push(methodNode)
      }
    })

    fieldMap.forEach((fieldNode) => {
      let isOrphaned = true
      classMap.forEach((classNode) => {
        if (classNode.children!.some(child => child.nodeId === fieldNode.nodeId)) {
          isOrphaned = false
        }
      })
      if (isOrphaned) {
        rootNodes.push(fieldNode)
      }
    })

    // Sort children for better display
    const sortChildren = (nodes: FileTreeNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          node.children.sort((a, b) => {
            // Sort by type first (packages, modules, classes, methods, fields)
            const typeOrder = { package: 0, module: 1, class: 2, method: 3, field: 4 }
            const typeA = typeOrder[a.entityType] || 5
            const typeB = typeOrder[b.entityType] || 5
            if (typeA !== typeB) return typeA - typeB
            
            // Then sort by name
            return a.searchText.localeCompare(b.searchText)
          })
          sortChildren(node.children)
        }
      })
    }

    sortChildren(rootNodes)

    console.log('FileTreeSidebar - Built hierarchical tree with', rootNodes.length, 'root nodes')
    console.log('FileTreeSidebar - Sample tree structure:', rootNodes.slice(0, 2))

    // If no root nodes found, create a simple flat list for debugging
    if (rootNodes.length === 0) {
      console.log('FileTreeSidebar - No hierarchy built, creating simple list')
      const simpleNodes: FileTreeNode[] = []
      
      // Add all modules as simple list
      moduleMap.forEach((moduleNode) => {
        simpleNodes.push(moduleNode)
      })
      
      if (simpleNodes.length === 0) {
        // Add all packages if no modules
        packageMap.forEach((packageNode) => {
          simpleNodes.push(packageNode)
        })
      }
      
      console.log('FileTreeSidebar - Simple list has', simpleNodes.length, 'nodes')
      return simpleNodes
    }

    return rootNodes
  }, [analysisData])

  // Filter tree data based on search
  const filteredTreeData = useMemo(() => {
    if (!searchValue) return treeData

    const filterTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.reduce((filtered: FileTreeNode[], node) => {
        const isMatch = node.searchText.toLowerCase().includes(searchValue.toLowerCase())
        const filteredChildren = node.children ? filterTree(node.children) : []
        
        if (isMatch || filteredChildren.length > 0) {
          filtered.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children
          })
        }
        
        return filtered
      }, [])
    }

    return filterTree(treeData)
  }, [treeData, searchValue])

  // Auto expand matching nodes when searching
  useEffect(() => {
    if (searchValue) {
      const getAllKeys = (nodes: FileTreeNode[]): string[] => {
        let keys: string[] = []
        nodes.forEach(node => {
          keys.push(node.key)
          if (node.children) {
            keys = keys.concat(getAllKeys(node.children))
          }
        })
        return keys
      }
      setExpandedKeys(getAllKeys(filteredTreeData))
      setAutoExpandParent(true)
    } else {
      // Auto-expand first level when not searching
      const firstLevelKeys = treeData.map(node => node.key)
      setExpandedKeys(firstLevelKeys)
    }
  }, [searchValue, filteredTreeData, treeData])

  const onExpand: TreeProps['onExpand'] = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue as string[])
    setAutoExpandParent(false)
  }

  const onSelect: TreeProps['onSelect'] = (selectedKeys, info) => {
    if (selectedKeys.length > 0 && info.node) {
      const nodeData = info.node as any
      console.log('FileTreeSidebar - Selected node:', nodeData.nodeId, nodeData.entityType)
      onNodeSelect?.(nodeData.nodeId, nodeData.entityType)
    }
  }

  // Highlight selected node
  const selectedKeys = selectedNodeId ? 
    treeData.map(node => {
      const findMatchingKey = (nodes: FileTreeNode[]): string | null => {
        for (const node of nodes) {
          if (node.nodeId === selectedNodeId) return node.key
          if (node.children) {
            const found = findMatchingKey(node.children)
            if (found) return found
          }
        }
        return null
      }
      return findMatchingKey([node])
    }).filter(key => key !== null) : []

  console.log('FileTreeSidebar - Rendering with tree data:', treeData.length, 'nodes')

  return (
    <div style={{ height: '100%', ...style }}>
      <Card 
        title="File Explorer" 
        size="small" 
        style={{ height: '100%' }}
        bodyStyle={{ padding: 0, height: 'calc(100% - 57px)' }}
      >
        <div style={{ padding: '8px' }}>
          <Search
            placeholder="Search files..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
          />
        </div>
        
        <div style={{ 
          height: 'calc(100% - 60px)', 
          overflow: 'auto',
          padding: '0 8px'
        }}>
          {filteredTreeData.length > 0 ? (
            <Tree
              showIcon={false}
              onExpand={onExpand}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onSelect={onSelect}
              selectedKeys={selectedKeys}
              treeData={filteredTreeData}
              blockNode
            />
          ) : (
            <Empty 
              description={treeData.length === 0 ? "No files found" : "No search results"} 
              style={{ marginTop: 50 }} 
            />
          )}
        </div>
      </Card>
    </div>
  )
}

export default FileTreeSidebar