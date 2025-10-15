// File Tree Sidebar Component for IDE-like file navigation  
import React, { useState, useEffect, useMemo } from 'react'
import { Tree, Input, Card, Empty } from 'antd'
import {
  SearchOutlined,
  ExclamationCircleOutlined,
  CodeOutlined,
  BuildOutlined,
  SettingOutlined,
  TagOutlined,
  FileOutlined,
  FolderOutlined
} from '@ant-design/icons'
import type { TreeProps } from 'antd/es/tree'

const { Search } = Input

type EntityType = 'package' | 'module' | 'class' | 'method' | 'field' | 'folder' | 'file'

// 🗂️ 그래프 노드와 똑같은 모듈명 파싱
const getSimpleModuleName = (moduleData: any): string => {
  const nodeId = moduleData.id || 'unknown'

  // 콜론(:)이 있으면 뒤쪽 부분만 사용 (예: "mfimp_mod:mfimp" → "mfimp")
  if (nodeId.includes(':')) {
    return nodeId.split(':').pop() || nodeId
  }

  return nodeId
}

// 🗂️ 파일 경로를 파싱해서 폴더 구조 생성
const parseFilePath = (filepath: string): string[] => {
  // 다양한 경로 형태 처리
  let cleanPath = filepath

  // "mod:" 같은 프리픽스 제거
  if (cleanPath.includes(':')) {
    cleanPath = cleanPath.split(':').pop() || cleanPath
  }

  // 백슬래시를 슬래시로 변환
  cleanPath = cleanPath.replace(/\\/g, '/')

  // 🗂️ 프로젝트 루트 경로 제거 (다양한 패턴 시도)
  // 패턴 1: .../pyview/ 이후 경로만 사용
  const pyviewPattern = /.*\/pyview\//
  if (pyviewPattern.test(cleanPath)) {
    cleanPath = cleanPath.replace(pyviewPattern, '')
  } else {
    // 패턴 2: .../opensource/pyview/ 이후 경로만 사용
    const opensourcePattern = /.*\/opensource\/pyview\//
    if (opensourcePattern.test(cleanPath)) {
      cleanPath = cleanPath.replace(opensourcePattern, '')
    } else {
      // 패턴 3: 절대 경로를 상대 경로로 변경하는 더 강력한 방법
      const pathSegments = cleanPath.split('/')
      const pyviewIndex = pathSegments.lastIndexOf('pyview')

      if (pyviewIndex !== -1 && pyviewIndex < pathSegments.length - 1) {
        // pyview 다음 부분부터 사용
        cleanPath = pathSegments.slice(pyviewIndex + 1).join('/')
      } else {
        // fallback: 파일명만 사용
        cleanPath = pathSegments[pathSegments.length - 1] || cleanPath
      }
    }
  }

  // 앞뒤 슬래시 제거
  cleanPath = cleanPath.replace(/^\/+|\/+$/g, '')

  // 빈 부분 제거하고 경로 분할
  const result = cleanPath.split('/').filter(part => part.length > 0)

  // Debug only for unexpected cases
  if (result.length === 0 || !result[result.length - 1]) {
    // Unexpected path parsing result
  }

  return result
}

// 🗂️ 노드 타입에 따른 아이콘과 색상
const getFileIcon = (filename: string, entityType?: EntityType) => {
  if (entityType) {
    switch (entityType) {
      case 'folder': return <FolderOutlined style={{ marginRight: 6, color: '#1890ff' }} />
      case 'module': return <CodeOutlined style={{ marginRight: 6, color: '#52c41a' }} />
      case 'class': return <BuildOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
      case 'method': return <SettingOutlined style={{ marginRight: 6, color: '#eb2f96' }} />
      case 'field': return <TagOutlined style={{ marginRight: 6, color: '#722ed1' }} />
    }
  }

  // 파일 확장자 기반 아이콘 (모듈로 처리되지 않은 경우)
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'py': return <CodeOutlined style={{ marginRight: 6, color: '#52c41a' }} />
    case 'js': case 'ts': case 'jsx': case 'tsx': return <CodeOutlined style={{ marginRight: 6, color: '#52c41a' }} />
    case 'java': return <CodeOutlined style={{ marginRight: 6, color: '#52c41a' }} />
    default: return <FileOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
  }
}

// 🗂️ 파일 시스템 트리 구성
const buildFileSystemTree = (modules: any[], classes: any[], methods: any[], fields: any[], cycleInfo: any): FileSystemNode => {
  const root: FileSystemNode = {
    name: 'root',
    path: '',
    isFolder: true,
    children: new Map()
  }

  // 모듈을 파일로 처리하고 클래스/메서드/필드를 그 안에 배치
  modules.forEach((mod: any, index: number) => {
    // 🔍 실제 file_path 사용
    const filepath = mod.file_path || mod.name || mod.id || 'unknown'

    // Debug: 모듈 데이터 확인
    if (index < 3) {
      // Module data logging removed
    }

    const pathParts = parseFilePath(filepath)

    const isInCycle = cycleInfo.cycleNodes.has(mod.id)

    let currentNode = root

    // 📁 실제 파일 경로를 따라 폴더 구조 생성
    for (let i = 0; i < pathParts.length - 1; i++) {
      const folderName = pathParts[i]
      const folderPath = pathParts.slice(0, i + 1).join('/')

      if (!currentNode.children.has(folderName)) {
        currentNode.children.set(folderName, {
          name: folderName,
          path: folderPath,
          isFolder: true,
          children: new Map()
        })
      }
      currentNode = currentNode.children.get(folderName)!
    }

    // 파일 생성 - 간단한 모듈명 추출
    const filename = getSimpleModuleName(mod)
    // 더 안전한 고유 키 생성 (모듈 ID를 기반으로)
    const uniqueKey = `module_${mod.id.replace(/[^a-zA-Z0-9_]/g, '_')}`

    if (!currentNode.children.has(uniqueKey)) {
      const fileNode: FileSystemNode = {
        name: filename,
        path: filepath,
        isFolder: false,
        children: new Map(),
        nodeId: mod.id,
        entityType: 'module',
        isInCycle
      }

      // 이 모듈에 속한 클래스들을 파일 안에 추가
      classes.forEach((cls: any) => {
        if (cls.module_id === mod.id) {
          const clsIsInCycle = cycleInfo.cycleNodes.has(cls.id)
          const classNode: FileSystemNode = {
            name: cls.name || cls.id,
            path: `${filepath}:${cls.name || cls.id}`,
            isFolder: false,
            children: new Map(),
            nodeId: cls.id,
            entityType: 'class',
            isInCycle: clsIsInCycle
          }

          // 이 클래스에 속한 메서드들 추가
          methods.forEach((method: any) => {
            if (method.class_id === cls.id) {
              const methodIsInCycle = cycleInfo.cycleNodes.has(method.id)
              const methodKey = `method_${method.id.replace(/[^a-zA-Z0-9_]/g, '_')}`
              classNode.children.set(methodKey, {
                name: method.name || method.id,
                path: `${filepath}:${cls.name}:${method.name}`,
                isFolder: false,
                children: new Map(),
                nodeId: method.id,
                entityType: 'method',
                isInCycle: methodIsInCycle
              })
            }
          })

          // 이 클래스에 속한 필드들 추가
          fields.forEach((field: any) => {
            if (field.class_id === cls.id) {
              const fieldIsInCycle = cycleInfo.cycleNodes.has(field.id)
              const fieldKey = `field_${field.id.replace(/[^a-zA-Z0-9_]/g, '_')}`
              classNode.children.set(fieldKey, {
                name: field.name || field.id,
                path: `${filepath}:${cls.name}:${field.name}`,
                isFolder: false,
                children: new Map(),
                nodeId: field.id,
                entityType: 'field',
                isInCycle: fieldIsInCycle
              })
            }
          })

          const classKey = `class_${cls.id.replace(/[^a-zA-Z0-9_]/g, '_')}`
          fileNode.children.set(classKey, classNode)
        }
      })

      currentNode.children.set(uniqueKey, fileNode)
    }
  })

  return root
}

// 🗂️ FileSystemNode를 FileTreeNode로 변환
const convertFileSystemToTreeNodes = (fsNode: FileSystemNode, cycleInfo: any): FileTreeNode[] => {
  const nodes: FileTreeNode[] = []

  // 자식 노드들을 정렬 (폴더 먼저, 그다음 파일들을 알파벳순)
  const sortedChildren = Array.from(fsNode.children.entries()).sort(([nameA, nodeA], [nameB, nodeB]) => {
    if (nodeA.isFolder !== nodeB.isFolder) {
      return nodeA.isFolder ? -1 : 1 // 폴더가 먼저
    }
    return nameA.localeCompare(nameB) // 알파벳순
  })

  sortedChildren.forEach(([name, childNode]) => {
    const isInCycle = childNode.isInCycle || false

    if (childNode.isFolder) {
      // 폴더 노드
      const folderTreeNode: FileTreeNode = {
        key: `folder_${childNode.path.replace(/[^a-zA-Z0-9_/]/g, '_')}`,
        title: (
          <span>
            {getFileIcon(childNode.name, 'folder')}
            <span style={{ color: isInCycle ? '#ff4d4f' : 'inherit' }}>
              {childNode.name}
            </span>
            {isInCycle && (
              <ExclamationCircleOutlined
                style={{ marginLeft: 8, fontSize: '12px', color: '#ff4d4f' }}
                title="Circular dependency"
              />
            )}
          </span>
        ),
        entityType: 'folder',
        searchText: childNode.name,
        nodeId: childNode.path,
        children: convertFileSystemToTreeNodes(childNode, cycleInfo),
        isFolder: true,
        filePath: childNode.path,
        isInCycle
      }
      nodes.push(folderTreeNode)
    } else {
      // 파일 노드
      const hasChildren = childNode.children.size > 0
      const childNodes = hasChildren ? convertFileSystemToTreeNodes(childNode, cycleInfo) : []

      const fileTreeNode: FileTreeNode = {
        key: `file_${(childNode.nodeId || childNode.path).replace(/[^a-zA-Z0-9_]/g, '_')}`,
        title: (
          <span>
            {getFileIcon(childNode.name, childNode.entityType)}
            <span style={{ color: isInCycle ? '#ff4d4f' : 'inherit' }}>
              {childNode.name}
            </span>
            {isInCycle && (
              <ExclamationCircleOutlined
                style={{ marginLeft: 8, fontSize: '12px', color: '#ff4d4f' }}
                title="Circular dependency"
              />
            )}
          </span>
        ),
        entityType: childNode.entityType || 'file',
        searchText: childNode.name,
        nodeId: childNode.nodeId || childNode.path,
        children: childNodes,
        isLeaf: !hasChildren,
        isFolder: false,
        filePath: childNode.path,
        isInCycle
      }
      nodes.push(fileTreeNode)
    }
  })

  return nodes
}

// 🗂️ Visual Studio 스타일 파일 구조를 위한 새로운 인터페이스
interface FileSystemNode {
  name: string
  path: string
  isFolder: boolean
  children: Map<string, FileSystemNode>
  nodeId?: string
  entityType?: EntityType
  isInCycle?: boolean
}

interface FileTreeNode {
  key: string
  title: React.ReactNode
  children: FileTreeNode[]
  entityType: EntityType
  searchText: string
  nodeId: string
  isLeaf?: boolean
  isInCycle?: boolean
  filePath?: string  // 실제 파일 경로
  isFolder?: boolean // 폴더 여부
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

            // mod: 접두사 제거한 버전도 추가
            if (entity.startsWith('mod:')) {
              const withoutPrefix = entity.substring(4);
              cycleNodes.add(withoutPrefix);
            }

            // 다른 가능한 ID 패턴들도 추가
            if (entity.includes('.')) {
              const parts = entity.split('.');
              const lastPart = parts[parts.length - 1];
              cycleNodes.add(lastPart);
            }
          });
        }
      });
    }

    return { cycleNodes };
  }, [cycleData]);


  // 🗂️ Visual Studio 스타일 파일 시스템 트리 구조 생성
  const treeData: FileTreeNode[] = useMemo(() => {
    if (!analysisData) {
      return []
    }

    const dependencyGraph = analysisData.dependency_graph || {}

    // Debug: 실제 데이터 구조 확인
    if (dependencyGraph.modules) {
      // Module data analysis removed for performance
    }

    // 🗂️ 새로운 파일 시스템 기반 트리 생성
    const modules = dependencyGraph.modules || []
    const classes = dependencyGraph.classes || []
    const methods = dependencyGraph.methods || []
    const fields = dependencyGraph.fields || []

    // 파일 시스템 트리 구성
    const fileSystemRoot = buildFileSystemTree(modules, classes, methods, fields, cycleInfo)

    // FileTreeNode로 변환
    const treeNodes = convertFileSystemToTreeNodes(fileSystemRoot, cycleInfo)

    return treeNodes
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

              // Scrolled to selected node
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

                  // Scrolled to selected node (fallback)
                  break
                }
              }
            }
          }
        }, 500) // Wait for tree expansion animation and selection update

        // Auto-expanded path to selected node
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
        title="파일 탐색기" 
        size="small" 
        style={{ height: '100%' }}
        bodyStyle={{ padding: 0, height: 'calc(100% - 57px)' }}
      >
        <div style={{ padding: '8px' }}>
          <Search
            placeholder="파일 검색..."
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
              showIcon={true}
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