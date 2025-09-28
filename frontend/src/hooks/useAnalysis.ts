// React Hook for Analysis Management
import { useState, useCallback } from 'react'
import { ApiService } from '@/services/api'
import type {
  AnalysisRequest,
  AnalysisResponse,
  AnalysisStatusResponse,
} from '@/types/api'

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

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const startAnalysis = useCallback(async (request: AnalysisRequest) => {
    try {
      setIsLoading(true)
      setError(null)

      const response: AnalysisResponse = await ApiService.startAnalysis(request)
      
      if (response.analysis_id) {
        // Poll for status updates
        const statusInterval = setInterval(async () => {
          try {
            const status = await ApiService.getAnalysisStatus(response.analysis_id)
            setCurrentAnalysis(status)
            
            if (status.status === 'completed' || status.status === 'failed') {
              clearInterval(statusInterval)
              setIsLoading(false)
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