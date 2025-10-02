// React Hook for Analysis Management
import { useState, useCallback, useRef, useEffect } from 'react'
import { ApiService } from '@/services/api'
import type {
  AnalysisRequest,
  AnalysisResponse,
  AnalysisStatusResponse,
} from '@/types/api'
import { AnalysisStatus } from '@/types/api'

interface UseAnalysisResult {
  analyses: AnalysisStatusResponse[]
  currentAnalysis: AnalysisStatusResponse | null
  isLoading: boolean
  error: string | null
  startAnalysis: (request: AnalysisRequest) => Promise<void>
  getAnalysisStatus: (analysisId: string) => Promise<void>
  loadAllAnalyses: () => Promise<void>
  deleteAnalysis: (analysisId: string) => Promise<void>
  clearError: () => void
}

export const useAnalysis = (): UseAnalysisResult => {
  const [analyses, setAnalyses] = useState<AnalysisStatusResponse[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // WebSocket 연결 정리 함수
  const cleanupWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
      statusIntervalRef.current = null
    }
  }, [])

  // WebSocket으로 실시간 진행률 수신
  const connectWebSocket = useCallback((analysisId: string) => {
    cleanupWebSocket()

    const wsUrl = `ws://localhost:8000/ws/progress/${analysisId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected for analysis:', analysisId)
    }

    ws.onmessage = (event) => {
      try {
        const progressUpdate = JSON.parse(event.data)
        // 실시간 진행률 업데이트
        const newStatus = progressUpdate.stage === 'completed' ? AnalysisStatus.COMPLETED :
                         progressUpdate.stage === 'failed' ? AnalysisStatus.FAILED : AnalysisStatus.RUNNING

        setCurrentAnalysis(prev => prev ? {
          ...prev,
          progress: progressUpdate.progress || prev.progress,
          message: progressUpdate.message || prev.message,
          status: newStatus,
          updated_at: new Date().toISOString()
        } : null)

        // 완료 또는 실패 시 연결 정리
        if (newStatus === AnalysisStatus.COMPLETED || newStatus === AnalysisStatus.FAILED) {
          cleanupWebSocket()
          setIsLoading(false)
          if (newStatus === AnalysisStatus.FAILED) {
            setError(progressUpdate.message || 'Analysis failed')
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected for analysis:', analysisId)
    }
  }, [cleanupWebSocket])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return cleanupWebSocket
  }, [cleanupWebSocket])

  const startAnalysis = useCallback(async (request: AnalysisRequest) => {
    try {
      setIsLoading(true)
      setError(null)

      // 즉시 pending 상태의 임시 analysis 생성
      const tempAnalysisId = `temp-${Date.now()}`
      const pendingAnalysis: AnalysisStatusResponse = {
        analysis_id: tempAnalysisId,
        status: AnalysisStatus.PENDING,
        progress: 0,
        message: 'Starting analysis...',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setCurrentAnalysis(pendingAnalysis)

      const response: AnalysisResponse = await ApiService.startAnalysis(request)

      if (response.analysis_id) {
        // 실제 analysis_id로 업데이트
        setCurrentAnalysis(prev => prev ? {
          ...prev,
          analysis_id: response.analysis_id
        } : null)

        // WebSocket 연결로 실시간 진행률 수신
        connectWebSocket(response.analysis_id)

        // 백업용 polling (WebSocket이 실패할 경우)
        statusIntervalRef.current = setInterval(async () => {
          try {
            const status = await ApiService.getAnalysisStatus(response.analysis_id)

            if (status.status === AnalysisStatus.COMPLETED || status.status === AnalysisStatus.FAILED) {
              cleanupWebSocket()
              setCurrentAnalysis(status)
              setIsLoading(false)
              if (status.status === AnalysisStatus.FAILED) {
                setError(status.error || 'Analysis failed')
              }
            }
          } catch (err) {
            console.error('Failed to get analysis status:', err)
          }
        }, 2000) // WebSocket이 있으므로 polling은 더 느리게
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis')
      setCurrentAnalysis(null) // 실패 시 pending 상태 제거
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getAnalysisStatus = useCallback(async (analysisId: string) => {
    try {
      setIsLoading(true)
      const status = await ApiService.getAnalysisStatus(analysisId)
      setCurrentAnalysis(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get analysis status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadAllAnalyses = useCallback(async () => {
    try {
      setIsLoading(true)
      const allAnalyses = await ApiService.getAllAnalyses()
      setAnalyses(allAnalyses)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analyses')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deleteAnalysis = useCallback(async (analysisId: string) => {
    try {
      setIsLoading(true)
      await ApiService.deleteAnalysis(analysisId)
      setAnalyses(prev => prev.filter(a => a.analysis_id !== analysisId))
      if (currentAnalysis?.analysis_id === analysisId) {
        setCurrentAnalysis(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete analysis')
    } finally {
      setIsLoading(false)
    }
  }, [currentAnalysis])

  return {
    analyses,
    currentAnalysis,
    isLoading,
    error,
    startAnalysis,
    getAnalysisStatus,
    loadAllAnalyses,
    deleteAnalysis,
    clearError
  }
}

export default useAnalysis