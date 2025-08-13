// React Hook for Analysis Management
import { useState, useCallback } from 'react'
import { ApiService } from '@/services/api'
import { WebSocketService } from '@/services/websocket'
import type {
  AnalysisRequest,
  AnalysisResponse,
  AnalysisStatusResponse,
  ProgressUpdate
} from '@/types/api'

interface UseAnalysisResult {
  analyses: AnalysisStatusResponse[]
  currentAnalysis: AnalysisStatusResponse | null
  isLoading: boolean
  error: string | null
  progress: ProgressUpdate | null
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
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)
  const [wsService, setWsService] = useState<WebSocketService | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const startAnalysis = useCallback(async (request: AnalysisRequest) => {
    try {
      setIsLoading(true)
      setError(null)
      setProgress(null)

      const response: AnalysisResponse = await ApiService.startAnalysis(request)
      
      if (response.analysis_id) {
        // Set up WebSocket for real-time updates
        const ws = new WebSocketService(response.analysis_id)
        await ws.connect()
        
        ws.onProgress((update: ProgressUpdate) => {
          setProgress(update)
        })
        
        ws.onError((errorMsg: string) => {
          setError(errorMsg)
        })
        
        setWsService(ws)

        // Poll for status updates
        const statusInterval = setInterval(async () => {
          try {
            const status = await ApiService.getAnalysisStatus(response.analysis_id)
            setCurrentAnalysis(status)
            
            if (status.status === 'completed' || status.status === 'failed') {
              clearInterval(statusInterval)
              ws.disconnect()
              setWsService(null)
              if (status.status === 'failed') {
                setError(status.error || 'Analysis failed')
              }
            }
          } catch (err) {
            console.error('Failed to get analysis status:', err)
          }
        }, 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis')
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
        wsService?.disconnect()
        setWsService(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete analysis')
    } finally {
      setIsLoading(false)
    }
  }, [currentAnalysis, wsService])

  return {
    analyses,
    currentAnalysis,
    isLoading,
    error,
    progress,
    startAnalysis,
    getAnalysisStatus,
    loadAllAnalyses,
    deleteAnalysis,
    clearError
  }
}

export default useAnalysis