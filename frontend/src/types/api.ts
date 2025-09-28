// PyView 프론트엔드용 API 타입들
// FastAPI 백엔드 모델과 매칭됨

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
  enable_type_inference: boolean
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
  is_in_cycle?: boolean
  cycle_severity?: 'low' | 'medium' | 'high'
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

export interface QualityMetrics {
  entity_id: string
  entity_type: string
  cyclomatic_complexity: number
  cognitive_complexity: number
  lines_of_code: number
  afferent_coupling: number
  efferent_coupling: number
  instability: number
  maintainability_index: number
  technical_debt_ratio: number
  quality_grade: string
}

// 순환 참조 관련 타입들
export interface CyclePath {
  nodes: string[]
  relationship_type: 'import' | 'call'
  strength: number
}

export interface CycleMetrics {
  cycle_length: number
  total_strength: number
  average_strength: number
  severity: 'low' | 'medium' | 'high'
}

export interface CyclicDependency {
  cycle_id: string
  entities: string[]
  relationship_type: 'import' | 'call'
  severity: 'low' | 'medium' | 'high'
  paths: CyclePath[]
  metrics: CycleMetrics
  description: string
}

export interface CycleDetectionResponse {
  analysis_id: string
  cycles: CyclicDependency[]
  total_cycles: number
  cycle_statistics: {
    import_cycles: number
    call_cycles: number
    high_severity: number
    medium_severity: number
    low_severity: number
  }
}