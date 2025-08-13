// API Service for PyView Frontend
// Handles all communication with the FastAPI backend

import axios, { AxiosResponse } from 'axios'
import type {
  AnalysisRequest,
  AnalysisResponse,
  AnalysisStatusResponse,
  SearchRequest,
  SearchResponse,
  ErrorResponse
} from '@/types/api'

const API_BASE_URL = '/api'

// Configure axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.data) {
      // FastAPI error response format
      const errorData: ErrorResponse = error.response.data
      throw new Error(errorData.error || 'API request failed')
    }
    throw error
  }
)

export class ApiService {
  // Start new project analysis
  static async startAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
    const response = await apiClient.post<AnalysisResponse>('/analyze', request)
    return response.data
  }

  // Get analysis status
  static async getAnalysisStatus(analysisId: string): Promise<AnalysisStatusResponse> {
    const response = await apiClient.get<AnalysisStatusResponse>(`/analysis/${analysisId}/status`)
    return response.data
  }

  // Get analysis results
  static async getAnalysisResults(analysisId: string) {
    const response = await apiClient.get(`/analysis/${analysisId}/results`)
    return response.data
  }

  // Search entities within analysis
  static async searchEntities(request: SearchRequest): Promise<SearchResponse> {
    const response = await apiClient.post<SearchResponse>('/search', request)
    return response.data
  }

  // Get all analyses
  static async getAllAnalyses(): Promise<AnalysisStatusResponse[]> {
    const response = await apiClient.get<AnalysisStatusResponse[]>('/analyses')
    return response.data
  }

  // Delete analysis
  static async deleteAnalysis(analysisId: string): Promise<void> {
    await apiClient.delete(`/analysis/${analysisId}`)
  }
}

export default ApiService