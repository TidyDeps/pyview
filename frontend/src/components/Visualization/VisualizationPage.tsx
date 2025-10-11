// 그래프와 컨트롤이 있는 시각화 페이지
import React, { useState, useEffect } from 'react'
import { Row, Col, message, Alert, Spin, Progress } from 'antd'
import { ApiService } from '@/services/api'
import HierarchicalNetworkGraph from './HierarchicalNetworkGraph'
import FileTreeSidebar from '../FileTree/FileTreeSidebar'
import { transformAnalysisToGraph } from './transformAnalysisToGraph'

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
    type: 'import' | 'inheritance' | 'composition' | 'call' | 'reference' | 'contains'
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
          setLoadingStage('분석 결과를 가져오고 있습니다...')
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
        setLoadingStage('그래프 데이터를 처리하고 있습니다...')
        setLoadingProgress(15)

        // Use setTimeout to allow UI to update before heavy computation
        await new Promise(resolve => setTimeout(resolve, 100))

        if (!isMounted || abortController.signal.aborted) return;

        const transformedData = await transformAnalysisToGraph(results, (progress: number, stage: string, details?: string, stats?: { totalItems: number, processedItems: number, currentType: string }) => {
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
        setLoadingStage('그래프 시각화를 렌더링하고 있습니다...')
        setLoadingDetails('시각적 요소와 레이아웃을 준비하고 있습니다...')
        setProcessingStats({ totalItems: 0, processedItems: 0, currentType: '' })

        setGraphData(transformedData)

        // Simulate graph rendering time for better UX
        await new Promise(resolve => setTimeout(resolve, 500))

        if (!isMounted || abortController.signal.aborted) return;

        setLoadingProgress(100)
        setLoadingStage('시각화 준비 완료!')
        setLoadingDetails('그래프가 성공적으로 렌더링되었습니다')

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

  // Unified node selection handler
  const handleNodeSelection = (nodeId: string, source: 'file-tree' | 'graph', nodeType?: string) => {
    console.log(`${source === 'file-tree' ? '🌳 File tree' : '🎯 Graph'} selected:`, nodeId, nodeType || '')
    setSelectedNodeId(nodeId)

    // Try to get info from graph data first, then fallback to nodeType if provided
    const { type, name } = getNodeInfo(nodeId)

    // If getNodeInfo couldn't find it and we have nodeType from file tree, use that
    if (type === 'Node' && nodeType && source === 'file-tree') {
      const parsedName = nodeId.includes('/') ? nodeId.split('/').pop() || nodeId : nodeId
      const parsedType = nodeType.charAt(0).toUpperCase() + nodeType.slice(1)
      console.log('🔄 Using nodeType fallback:', { type: parsedType, name: parsedName })
      message.info(`선택된 ${parsedType}: ${parsedName}`)
    } else {
      console.log('✅ Using getNodeInfo result:', { type, name })
      message.info(`선택된 ${type}: ${name}`)
    }
  }

  // File tree node selection handler (wrapper)
  const handleFileTreeNodeSelect = (nodeId: string, nodeType: string) => {
    handleNodeSelection(nodeId, 'file-tree', nodeType)
  }

  // Graph node click handler (wrapper)
  const handleGraphNodeClick = (nodeId: string) => {
    handleNodeSelection(nodeId, 'graph')
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />

        {/* Main Loading Stage */}
        <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: '#1890ff' }}>
          {loadingStage || '시각화 데이터 로드 중...'}
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
            📋 처리 단계:
          </div>
          <div style={{ fontSize: 11, color: '#bfbfbf', lineHeight: 1.6 }}>
            {loadingProgress < 10 && '🔄 분석 데이터 가져오는 중...'}
            {loadingProgress >= 10 && loadingProgress < 20 && '✅ 분석 데이터 로드 완료'}
            {loadingProgress >= 20 && loadingProgress < 40 && '🔄 패키지 및 모듈 처리 중...'}
            {loadingProgress >= 40 && loadingProgress < 60 && '🔄 클래스 계층 구성 중...'}
            {loadingProgress >= 60 && loadingProgress < 80 && '🔄 메서드 및 필드 처리 중...'}
            {loadingProgress >= 80 && loadingProgress < 95 && '🔄 관계 구성 중...'}
            {loadingProgress >= 95 && loadingProgress < 100 && '🔄 그래프 시각화 렌더링 중...'}
            {loadingProgress >= 100 && '✅ 시각화 준비 완료!'}
          </div>
        </div>

        <div style={{ marginTop: 20, color: '#666', fontSize: 12 }}>
          💡 대용량 코드베이스는 처리 시간이 더 오래 걸릴 수 있습니다. 더 나은 성능을 위해 시각화를 최적화하는 동안 잠시 기다려 주세요.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        message="시각화 오류"
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
        message="분석이 선택되지 않음"
        description="의존성 그래프를 시각화하려면 먼저 분석을 실행해 주세요."
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