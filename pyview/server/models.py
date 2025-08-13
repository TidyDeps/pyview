"""
API Request/Response Models

Pydantic models for FastAPI request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class AnalysisStatus(str, Enum):
    """Analysis job status"""
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisOptions(BaseModel):
    """Analysis configuration options"""
    max_depth: int = Field(default=0, description="Maximum dependency depth (0 = unlimited)")
    exclude_patterns: List[str] = Field(default_factory=lambda: ["__pycache__", ".git", "test_*"], description="Patterns to exclude")
    include_stdlib: bool = Field(default=False, description="Include standard library modules")
    analysis_levels: List[str] = Field(default_factory=lambda: ["package", "module", "class", "method", "field"], description="Analysis levels to include")
    enable_type_inference: bool = Field(default=True, description="Enable type inference")
    max_workers: int = Field(default=4, description="Maximum parallel workers")


class AnalysisRequest(BaseModel):
    """Request to start analysis"""
    project_path: str = Field(..., description="Path to the Python project")
    options: AnalysisOptions = Field(default_factory=AnalysisOptions, description="Analysis options")


class AnalysisResponse(BaseModel):
    """Response when starting analysis"""
    analysis_id: str = Field(..., description="Unique analysis identifier")
    status: AnalysisStatus = Field(..., description="Current analysis status")
    message: str = Field(..., description="Status message")


class AnalysisStatusResponse(BaseModel):
    """Analysis status response"""
    analysis_id: str
    status: AnalysisStatus
    progress: float = Field(..., ge=0.0, le=100.0, description="Progress percentage")
    message: str
    created_at: str
    updated_at: str
    error: Optional[str] = None


class SearchRequest(BaseModel):
    """Search request"""
    query: str = Field(..., min_length=1, description="Search query")
    entity_type: Optional[str] = Field(default=None, description="Entity type filter (class, method, module)")
    analysis_id: Optional[str] = Field(default=None, description="Analysis ID to search within")


class SearchResult(BaseModel):
    """Individual search result"""
    name: str
    entity_type: str
    module_path: str
    file_path: str
    line_number: Optional[int] = None
    description: Optional[str] = None


class SearchResponse(BaseModel):
    """Search results response"""
    query: str
    total_results: int
    results: List[SearchResult]


class ProgressUpdate(BaseModel):
    """Progress update for WebSocket"""
    analysis_id: str
    stage: str
    progress: float
    message: str
    current_file: Optional[str] = None
    files_processed: Optional[int] = None
    total_files: Optional[int] = None


class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    detail: Optional[str] = None
    analysis_id: Optional[str] = None