// WebGL-based Dependency Graph Visualization Component
import React, { useRef, useEffect, useState } from 'react'
import { Card, Select, Space, Button, Typography, Slider } from 'antd'
import { FullscreenOutlined, ReloadOutlined } from '@ant-design/icons'
import * as THREE from 'three'

const { Title, Text } = Typography
const { Option } = Select

interface Node {
  id: string
  name: string
  type: 'package' | 'module' | 'class' | 'method' | 'field'
  x: number
  y: number
  z: number
  connections: string[]
}

interface Edge {
  source: string
  target: string
  type: 'import' | 'inheritance' | 'composition' | 'call' | 'reference'
}

interface DependencyGraphProps {
  data?: {
    nodes: Node[]
    edges: Edge[]
  }
  onNodeClick?: (node: Node) => void
}

const DependencyGraph: React.FC<DependencyGraphProps> = ({ data, onNodeClick }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const frameRef = useRef<number>()
  
  const [selectedLevel, setSelectedLevel] = useState<string>('module')
  const [nodeSize, setNodeSize] = useState<number>(5)
  const [showLabels, setShowLabels] = useState<boolean>(true)

  // Node colors by type
  const nodeColors = {
    package: 0x1890ff,
    module: 0x52c41a,
    class: 0xfa8c16,
    method: 0xeb2f96,
    field: 0x722ed1
  }

  // Edge colors by type
  const edgeColors = {
    import: 0x595959,
    inheritance: 0x13c2c2,
    composition: 0xa0d911,
    call: 0xf759ab,
    reference: 0x2f54eb
  }

  useEffect(() => {
    if (!mountRef.current) return

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f2f5)
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(50, 50, 100)
    cameraRef.current = camera

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer
    mountRef.current.appendChild(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4)
    directionalLight.position.set(100, 100, 100)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Controls (basic mouse interaction)
    let mouseDown = false
    let mouseX = 0
    let mouseY = 0

    const handleMouseDown = (event: MouseEvent) => {
      mouseDown = true
      mouseX = event.clientX
      mouseY = event.clientY
    }

    const handleMouseUp = () => {
      mouseDown = false
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseDown) return
      
      const deltaX = event.clientX - mouseX
      const deltaY = event.clientY - mouseY
      
      camera.position.x -= deltaX * 0.1
      camera.position.y += deltaY * 0.1
      
      mouseX = event.clientX
      mouseY = event.clientY
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const delta = event.deltaY > 0 ? 1.1 : 0.9
      camera.position.multiplyScalar(delta)
    }

    renderer.domElement.addEventListener('mousedown', handleMouseDown)
    renderer.domElement.addEventListener('mouseup', handleMouseUp)
    renderer.domElement.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('wheel', handleWheel)

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      camera.lookAt(scene.position)
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return
      
      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight
      
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      
      renderer.domElement.removeEventListener('mousedown', handleMouseDown)
      renderer.domElement.removeEventListener('mouseup', handleMouseUp)
      renderer.domElement.removeEventListener('mousemove', handleMouseMove)
      renderer.domElement.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', handleResize)
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  // Update visualization when data changes
  useEffect(() => {
    if (!data || !sceneRef.current) return

    // Clear existing objects
    const objectsToRemove = sceneRef.current.children.filter(
      child => child.type === 'Mesh' || child.type === 'Line'
    )
    objectsToRemove.forEach(obj => sceneRef.current!.remove(obj))

    // Filter nodes by selected level
    const filteredNodes = data.nodes.filter(node => 
      selectedLevel === 'all' || node.type === selectedLevel
    )

    // Create node meshes
    const nodeGeometry = new THREE.SphereGeometry(nodeSize, 16, 16)
    
    filteredNodes.forEach(node => {
      const material = new THREE.MeshLambertMaterial({
        color: nodeColors[node.type] || 0x999999
      })
      
      const mesh = new THREE.Mesh(nodeGeometry, material)
      mesh.position.set(node.x, node.y, node.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = { node }
      
      sceneRef.current!.add(mesh)
    })

    // Create edge lines
    const nodeMap = new Map(filteredNodes.map(node => [node.id, node]))
    
    data.edges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.source)
      const targetNode = nodeMap.get(edge.target)
      
      if (!sourceNode || !targetNode) return
      
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
        new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
      ])
      
      const material = new THREE.LineBasicMaterial({
        color: edgeColors[edge.type] || 0x999999,
        opacity: 0.6,
        transparent: true
      })
      
      const line = new THREE.Line(geometry, material)
      sceneRef.current!.add(line)
    })

  }, [data, selectedLevel, nodeSize])

  // Generate sample data for demo
  const generateSampleData = () => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    
    // Create sample nodes in a spiral pattern
    for (let i = 0; i < 50; i++) {
      const angle = i * 0.5
      const radius = i * 2
      const height = Math.sin(i * 0.2) * 20
      
      nodes.push({
        id: `node_${i}`,
        name: `Entity ${i}`,
        type: ['package', 'module', 'class', 'method', 'field'][i % 5] as any,
        x: Math.cos(angle) * radius,
        y: height,
        z: Math.sin(angle) * radius,
        connections: []
      })
    }
    
    // Create sample edges
    for (let i = 0; i < 30; i++) {
      const sourceIdx = Math.floor(Math.random() * nodes.length)
      let targetIdx = Math.floor(Math.random() * nodes.length)
      while (targetIdx === sourceIdx) {
        targetIdx = Math.floor(Math.random() * nodes.length)
      }
      
      edges.push({
        source: nodes[sourceIdx].id,
        target: nodes[targetIdx].id,
        type: ['import', 'inheritance', 'composition', 'call', 'reference'][Math.floor(Math.random() * 5)] as any
      })
    }
    
    return { nodes, edges }
  }

  const sampleData = data || generateSampleData()

  const handleFullscreen = () => {
    if (mountRef.current) {
      mountRef.current.requestFullscreen()
    }
  }

  const handleReset = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(50, 50, 100)
    }
  }

  return (
    <Card
      title="Dependency Graph Visualization"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            Reset View
          </Button>
          <Button icon={<FullscreenOutlined />} onClick={handleFullscreen}>
            Fullscreen
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <div>
            <Text>Level: </Text>
            <Select
              value={selectedLevel}
              onChange={setSelectedLevel}
              style={{ width: 120 }}
            >
              <Option value="all">All</Option>
              <Option value="package">Package</Option>
              <Option value="module">Module</Option>
              <Option value="class">Class</Option>
              <Option value="method">Method</Option>
              <Option value="field">Field</Option>
            </Select>
          </div>
          
          <div style={{ width: 200 }}>
            <Text>Node Size: </Text>
            <Slider
              min={1}
              max={20}
              value={nodeSize}
              onChange={setNodeSize}
              style={{ width: 120 }}
            />
          </div>
        </Space>
      </div>
      
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '600px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          overflow: 'hidden'
        }}
      />
      
      <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
        <Space wrap>
          <div>🔵 Package</div>
          <div>🟢 Module</div>
          <div>🟠 Class</div>
          <div>🟡 Method</div>
          <div>🟣 Field</div>
        </Space>
      </div>
    </Card>
  )
}

export default DependencyGraph