// File Tree Sidebar Component for IDE-like file navigation  
import React, { useState, useEffect, useMemo } from 'react'
import { Tree, Input, Card, Empty } from 'antd'
import { 
  FolderOutlined, 
  FileOutlined,
  FunctionOutlined,
  BlockOutlined,
  SearchOutlined,
  FieldBinaryOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import type { TreeProps } from 'antd/es/tree'

const { Search } = Input

type EntityType = 'package' | 'module' | 'class' | 'method' | 'field'

interface FileTreeNode {
  key: string
  title: React.ReactNode
  children: FileTreeNode[]
  entityType: EntityType
  searchText: string
  nodeId: string
  isLeaf?: boolean
  isInCycle?: boolean
}

interface FileTreeSidebarProps {
  analysisData?: any
  cycleData?: any // 순환 참조 데이터
  onNodeSelect?: (nodeId: string, nodeType: EntityType) => void
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
  const [searchValue, setSearchValue] = useState<string>('')
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true)
  const treeContainerRef = React.useRef<HTMLDivElement>(null)

  // 순환 참조 정보 처리
  const cycleInfo = useMemo(() => {
    const cycleNodes = new Set<string>();

    if (cycleData && Array.isArray(cycleData.cycles)) {
      cycleData.cycles.forEach((cycle: any) => {
        if (Array.isArray(cycle.entities)) {
          cycle.entities.forEach((entity: string) => {
            cycleNodes.add(entity);
            console.log(`🔄 FileTree: Added cycle node: ${entity}`);

            // mod: 접두사 제거한 버전도 추가
            if (entity.startsWith('mod:')) {
              const withoutPrefix = entity.substring(4);
              cycleNodes.add(withoutPrefix);
              console.log(`🔄 FileTree: Also added without mod prefix: ${withoutPrefix}`);
            }

            // 다른 가능한 ID 패턴들도 추가
            if (entity.includes('.')) {
              const parts = entity.split('.');
              const lastPart = parts[parts.length - 1];
              cycleNodes.add(lastPart);
              console.log(`🔄 FileTree: Also added last part: ${lastPart}`);
            }
          });
        }
      });
    }

    return { cycleNodes };
  }, [cycleData]);

  // 순환 참조 아이콘 렌더링
  const renderCycleIcon = (nodeId: string) => {
    if (!cycleInfo.cycleNodes.has(nodeId)) return null;
    const iconStyle = {
      marginLeft: 8,
      fontSize: '12px',
      color: '#ff4d4f'
    };
    return (
      <ExclamationCircleOutlined
        style={iconStyle}
        title="Circular dependency"
      />
    );
  };

  // Build proper hierarchical tree structure
  const treeData: FileTreeNode[] = useMemo(() => {
    if (!analysisData) {
      return []
    }

    const dependencyGraph = analysisData.dependency_graph || {}

    // Use correct types for maps
    const packageMap = new Map<string, FileTreeNode>()
    const moduleMap = new Map<string, FileTreeNode>()
    const classMap = new Map<string, FileTreeNode>()
    const methodMap = new Map<string, FileTreeNode>()
    const fieldMap = new Map<string, FileTreeNode>()

    // First, create all entities and populate maps
    if (Array.isArray(dependencyGraph.packages)) {
      dependencyGraph.packages.forEach((pkg: any) => {
        const pkgId: string = pkg.id || pkg.package_id || pkg.name
        const isInCycle = cycleInfo.cycleNodes.has(pkgId);
        const packageNode: FileTreeNode = {
          key: `package_${pkgId}`,
          title: (
            <span>
              <FolderOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              <span style={{ color: isInCycle ? '#ff4d4f' : 'inherit' }}>
                {pkg.name || pkgId}
              </span>
              {renderCycleIcon(pkgId)}
            </span>
          ),
          entityType: 'package',
          searchText: pkg.name || pkgId,
          nodeId: pkgId,
          children: [],
          isInCycle,
        }
        packageMap.set(pkgId, packageNode)
      })
    }

    if (Array.isArray(dependencyGraph.modules)) {
      dependencyGraph.modules.forEach((mod: any) => {
        const modId: string = mod.id || mod.module_id || mod.name
        const isInCycle = cycleInfo.cycleNodes.has(modId);
        const moduleNode: FileTreeNode = {
          key: `module_${modId}`,
          title: (
            <span>
              <FileOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              <span style={{ color: isInCycle ? '#ff4d4f' : 'inherit' }}>
                {mod.name || modId}
              </span>
              {renderCycleIcon(modId)}
            </span>
          ),
          entityType: 'module',
          searchText: mod.name || modId,
          nodeId: modId,
          children: [],
          isInCycle
        }
        moduleMap.set(modId, moduleNode)
      })
    }

    if (Array.isArray(dependencyGraph.classes)) {
      dependencyGraph.classes.forEach((cls: any) => {
        const clsId: string = cls.id || cls.class_id || cls.name
        const isInCycle = cycleInfo.cycleNodes.has(clsId);
        const classNode: FileTreeNode = {
          key: `class_${clsId}`,
          title: (
            <span>
              <BlockOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
              <span style={{ color: isInCycle ? '#ff4d4f' : 'inherit' }}>
                {cls.name || clsId}
              </span>
              {renderCycleIcon(clsId)}
            </span>
          ),
          entityType: 'class',
          searchText: cls.name || clsId,
          nodeId: clsId,
          children: [],
          isInCycle,
        }
        classMap.set(clsId, classNode)
      })
    }

    if (Array.isArray(dependencyGraph.methods)) {
      dependencyGraph.methods.forEach((method: any) => {
        const methodId: string = method.id || method.method_id || method.name
        const isInCycle = cycleInfo.cycleNodes.has(methodId);
        const methodNode: FileTreeNode = {
          key: `method_${methodId}`,
          title: (
            <span>
              <FunctionOutlined style={{ marginRight: 8, color: '#eb2f96' }} />
              <span style={{ color: isInCycle ? '#ff4d4f' : 'inherit' }}>
                {method.name || methodId}
              </span>
              {renderCycleIcon(methodId)}
            </span>
          ),
          entityType: 'method',
          searchText: method.name || methodId,
          nodeId: methodId,
          children: [],
          isLeaf: true,
          isInCycle,
        }
        methodMap.set(methodId, methodNode)
      })
    }

    if (Array.isArray(dependencyGraph.fields)) {
      dependencyGraph.fields.forEach((field: any) => {
        const fieldId: string = field.id || field.field_id || field.name
        const isInCycle = cycleInfo.cycleNodes.has(fieldId);
        const fieldNode: FileTreeNode = {
          key: `field_${fieldId}`,
          title: (
            <span>
              <FieldBinaryOutlined style={{ marginRight: 8, color: '#722ed1' }} />
              <span style={{ color: isInCycle ? '#ff4d4f' : 'inherit' }}>
                {field.name || fieldId}
              </span>
              {renderCycleIcon(fieldId)}
            </span>
          ),
          entityType: 'field',
          searchText: field.name || fieldId,
          nodeId: fieldId,
          children: [],
          isLeaf: true,
          isInCycle,
        }
        fieldMap.set(fieldId, fieldNode)
      })
    }

    // Build hierarchy using direct relationships from demo data structure
    if (Array.isArray(dependencyGraph.packages)) {
      dependencyGraph.packages.forEach((pkg: any) => {
        const pkgId: string = pkg.id || pkg.package_id || pkg.name
        const packageNode = packageMap.get(pkgId)
        if (packageNode && Array.isArray(dependencyGraph.modules)) {
          dependencyGraph.modules.forEach((mod: any) => {
            if (mod.package_id === pkgId) {
              const modId: string = mod.id || mod.module_id || mod.name
              const moduleNode = moduleMap.get(modId)
              if (moduleNode) {
                packageNode.children.push(moduleNode)
              }
            }
          })
        }
      })
    }

    if (Array.isArray(dependencyGraph.classes)) {
      dependencyGraph.classes.forEach((cls: any) => {
        const clsId: string = cls.id || cls.class_id || cls.name
        const classNode = classMap.get(clsId)
        if (classNode && cls.module_id) {
          const moduleNode = moduleMap.get(cls.module_id)
          if (moduleNode) {
            moduleNode.children.push(classNode)
          }
        }
      })
    }

    if (Array.isArray(dependencyGraph.methods)) {
      dependencyGraph.methods.forEach((method: any) => {
        const methodId: string = method.id || method.method_id || method.name
        const methodNode = methodMap.get(methodId)
        if (methodNode && method.class_id) {
          const classNode = classMap.get(method.class_id)
          if (classNode) {
            classNode.children.push(methodNode)
          }
        }
      })
    }

    if (Array.isArray(dependencyGraph.fields)) {
      dependencyGraph.fields.forEach((field: any) => {
        const fieldId: string = field.id || field.field_id || field.name
        const fieldNode = fieldMap.get(fieldId)
        if (fieldNode && field.class_id) {
          const classNode = classMap.get(field.class_id)
          if (classNode) {
            classNode.children.push(fieldNode)
          }
        }
      })
    }

    // If no relationships exist, try to infer hierarchy from naming conventions
    if (!Array.isArray(analysisData.relationships) || analysisData.relationships.length === 0) {
      // Try to match modules to packages based on name prefixes
      moduleMap.forEach((moduleNode) => {
        const moduleName = moduleNode.searchText
        let bestMatch: FileTreeNode | null = null
        let bestMatchLength = 0
        packageMap.forEach((packageNode) => {
          const packageName = packageNode.searchText
          if (moduleName.startsWith(packageName) && packageName.length > bestMatchLength) {
            bestMatch = packageNode
            bestMatchLength = packageName.length
          }
        })
        if (bestMatch) {
          (bestMatch as FileTreeNode).children.push(moduleNode)
        }
      })

      // Try to match classes to modules based on name prefixes
      classMap.forEach((classNode) => {
        const className = classNode.searchText
        let bestMatch: FileTreeNode | null = null
        let bestMatchLength = 0
        moduleMap.forEach((moduleNode) => {
          const moduleName = moduleNode.searchText
          if (className.startsWith(moduleName) && moduleName.length > bestMatchLength) {
            bestMatch = moduleNode
            bestMatchLength = moduleName.length
          }
        })
        if (bestMatch) {
          (bestMatch as FileTreeNode).children.push(classNode)
        }
      })

      // Try to match methods to classes based on name prefixes
      methodMap.forEach((methodNode) => {
        const methodName = methodNode.searchText
        let bestMatch: FileTreeNode | null = null
        let bestMatchLength = 0
        classMap.forEach((classNode) => {
          const className = classNode.searchText
          if (methodName.startsWith(className) && className.length > bestMatchLength) {
            bestMatch = classNode
            bestMatchLength = className.length
          }
        })
        if (bestMatch) {
          (bestMatch as FileTreeNode).children.push(methodNode)
        }
      })

      // Try to match fields to classes based on name prefixes
      fieldMap.forEach((fieldNode) => {
        const fieldName = fieldNode.searchText
        let bestMatch: FileTreeNode | null = null
        let bestMatchLength = 0
        classMap.forEach((classNode) => {
          const className = classNode.searchText
          if (fieldName.startsWith(className) && className.length > bestMatchLength) {
            bestMatch = classNode
            bestMatchLength = className.length
          }
        })
        if (bestMatch) {
          (bestMatch as FileTreeNode).children.push(fieldNode)
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
        if (packageNode.children.some(child => child.nodeId === moduleNode.nodeId)) {
          isOrphaned = false
        }
      })
      if (isOrphaned) {
        rootNodes.push(moduleNode)
      }
    })

    // Add orphaned classes (classes not contained in any module or package)
    classMap.forEach((classNode) => {
      let isOrphaned = true
      moduleMap.forEach((moduleNode) => {
        if (moduleNode.children.some(child => child.nodeId === classNode.nodeId)) {
          isOrphaned = false
        }
      })
      packageMap.forEach((packageNode) => {
        if (packageNode.children.some(child => child.nodeId === classNode.nodeId)) {
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
        if (classNode.children.some(child => child.nodeId === methodNode.nodeId)) {
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
        if (classNode.children.some(child => child.nodeId === fieldNode.nodeId)) {
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
        if (node.children.length > 0) {
          node.children.sort((a, b) => {
            // Sort by type first (packages, modules, classes, methods, fields)
            const typeOrder: Record<EntityType, number> = { package: 0, module: 1, class: 2, method: 3, field: 4 }
            const typeA = typeOrder[a.entityType] ?? 5
            const typeB = typeOrder[b.entityType] ?? 5
            if (typeA !== typeB) return typeA - typeB
            // Then sort by name
            return a.searchText.localeCompare(b.searchText)
          })
          sortChildren(node.children)
        }
      })
    }

    sortChildren(rootNodes)

    // If no root nodes found, create a simple flat list for debugging
    if (rootNodes.length === 0) {
      const simpleNodes: FileTreeNode[] = []
      moduleMap.forEach((moduleNode) => {
        simpleNodes.push(moduleNode)
      })
      if (simpleNodes.length === 0) {
        packageMap.forEach((packageNode) => {
          simpleNodes.push(packageNode)
        })
      }
      return simpleNodes
    }

    return rootNodes
  }, [analysisData, cycleInfo])

  // Filter tree data based on search
  const filteredTreeData: FileTreeNode[] = useMemo(() => {
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
      const getAllKeys = (nodes: FileTreeNode[]): React.Key[] => {
        let keys: React.Key[] = []
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

  // Auto expand and scroll to selected node when selectedNodeId changes
  useEffect(() => {
    if (selectedNodeId && treeData.length > 0) {
      const findNodeAndParents = (nodes: FileTreeNode[], targetNodeId: string, parentKeys: React.Key[] = []): React.Key[] | null => {
        for (const node of nodes) {
          if (node.nodeId === targetNodeId) {
            return [...parentKeys, node.key]
          }
          if (node.children) {
            const result = findNodeAndParents(node.children, targetNodeId, [...parentKeys, node.key])
            if (result) return result
          }
        }
        return null
      }

      const pathToNode = findNodeAndParents(treeData, selectedNodeId)
      if (pathToNode) {
        // Expand all parent nodes
        setExpandedKeys(prev => {
          const newKeys = new Set([...prev, ...pathToNode.slice(0, -1)]) // All except the target node itself
          return Array.from(newKeys)
        })
        setAutoExpandParent(false)

        // Scroll to the selected node after a short delay to allow for expansion
        setTimeout(() => {
          if (treeContainerRef.current) {
            // Find the selected tree node element
            const selectedTreeNode = treeContainerRef.current.querySelector('.ant-tree-node-selected')
            if (selectedTreeNode) {
              // Scroll the tree container to show the selected node
              const containerRect = treeContainerRef.current.getBoundingClientRect()
              const nodeRect = selectedTreeNode.getBoundingClientRect()
              const containerScrollTop = treeContainerRef.current.scrollTop

              // Calculate the position to center the node in the container
              const targetScrollTop = containerScrollTop + (nodeRect.top - containerRect.top) - (containerRect.height / 2) + (nodeRect.height / 2)

              treeContainerRef.current.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
              })

              console.log('FileTree: Scrolled to selected node:', selectedNodeId)
            } else {
              // Fallback: try to find by content
              const allTreeNodes = treeContainerRef.current.querySelectorAll('.ant-tree-node-content-wrapper')
              for (const nodeElement of allTreeNodes) {
                if (nodeElement.textContent?.includes(selectedNodeId.split(':').pop() || selectedNodeId)) {
                  const containerRect = treeContainerRef.current.getBoundingClientRect()
                  const nodeRect = nodeElement.getBoundingClientRect()
                  const containerScrollTop = treeContainerRef.current.scrollTop

                  const targetScrollTop = containerScrollTop + (nodeRect.top - containerRect.top) - (containerRect.height / 2) + (nodeRect.height / 2)

                  treeContainerRef.current.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth'
                  })

                  console.log('FileTree: Scrolled to selected node (fallback):', selectedNodeId)
                  break
                }
              }
            }
          }
        }, 500) // Wait for tree expansion animation and selection update

        console.log('FileTree: Auto-expanded path to selected node:', selectedNodeId, pathToNode)
      }
    }
  }, [selectedNodeId, treeData])

  const onExpand: TreeProps['onExpand'] = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue as React.Key[])
    setAutoExpandParent(false)
  }

  const onSelect: TreeProps['onSelect'] = (selectedKeys, info) => {
    if (selectedKeys.length > 0 && info.node) {
      // info.node is TreeDataNode, but we need our FileTreeNode fields
      const nodeData = info.node as any as FileTreeNode
      onNodeSelect?.(nodeData.nodeId, nodeData.entityType)
    }
  }

  // Highlight selected node
  const selectedKeys: React.Key[] = selectedNodeId ? 
    (() => {
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
      const keys: (string | null)[] = treeData.map(node => findMatchingKey([node]))
      return keys.filter((key): key is string => key !== null)
    })() : []

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
        
        <div
          ref={treeContainerRef}
          style={{
            height: 'calc(100% - 60px)',
            overflow: 'auto',
            padding: '0 8px'
          }}
        >
          {filteredTreeData.length > 0 ? (
            <Tree
              showIcon={false}
              onExpand={onExpand}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onSelect={onSelect}
              selectedKeys={selectedKeys}
              treeData={filteredTreeData as any}
              blockNode
              style={{
                '--ant-tree-node-selected-bg': 'transparent',
                '--ant-tree-node-hover-bg': '#f5f5f5'
              } as React.CSSProperties}
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