// API Types for PyView Frontend
// Matches the FastAPI backend models

export enum AnalysisStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface AnalysisOptions {
  max_depth: number
  exclude_patterns: string[]
  include_stdlib: boolean
  analysis_levels: string[]
  enable_type_inference: boolean
  max_workers: number
}

export interface AnalysisRequest {
  project_path: string
  options: AnalysisOptions
}

export interface AnalysisResponse {
  analysis_id: string
  status: AnalysisStatus
  message: string
}

export interface AnalysisStatusResponse {
  analysis_id: string
  status: AnalysisStatus
  progress: number
  message: string
  created_at: string
  updated_at: string
  error?: string
}

export interface SearchRequest {
  query: string
  entity_type?: string
  analysis_id?: string
}

export interface SearchResult {
  name: string
  entity_type: string
  module_path: string
  file_path: string
  line_number?: number
  description?: string
}

export interface SearchResponse {
  query: string
  total_results: number
  results: SearchResult[]
}

export interface ProgressUpdate {
  analysis_id: string
  stage: string
  progress: number
  message: string
  current_file?: string
  files_processed?: number
  total_files?: number
}

export interface ErrorResponse {
  error: string
  detail?: string
  analysis_id?: string
}