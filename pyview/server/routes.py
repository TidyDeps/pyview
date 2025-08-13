"""
API Routes

FastAPI route handlers for PyView analysis endpoints.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from typing import Optional
import uuid
import logging
import os

from .models import (
    AnalysisRequest, AnalysisResponse, AnalysisStatusResponse, 
    SearchRequest, SearchResponse, ErrorResponse,
    AnalysisStatus
)
from .services import AnalysisService, SearchService
from ..models import AnalysisResult


logger = logging.getLogger(__name__)
api_router = APIRouter()


# Dependency injection
def get_analysis_service() -> AnalysisService:
    """Get analysis service instance"""
    return AnalysisService()


def get_search_service() -> SearchService:
    """Get search service instance"""
    return SearchService()


@api_router.post("/analyze", response_model=AnalysisResponse)
async def start_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    """Start a new dependency analysis"""
    try:
        # Validate project path
        if not os.path.exists(request.project_path):
            raise HTTPException(status_code=400, detail=f"Project path does not exist: {request.project_path}")
        
        if not os.path.isdir(request.project_path):
            raise HTTPException(status_code=400, detail=f"Project path is not a directory: {request.project_path}")
        
        # Generate unique analysis ID
        analysis_id = str(uuid.uuid4())
        
        # Start analysis in background
        background_tasks.add_task(
            analysis_service.run_analysis,
            analysis_id, 
            request.project_path,
            request.options
        )
        
        logger.info(f"Started analysis {analysis_id} for project: {request.project_path}")
        
        return AnalysisResponse(
            analysis_id=analysis_id,
            status=AnalysisStatus.PENDING,
            message="Analysis started successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/analyze/{analysis_id}", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    analysis_id: str,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    """Get analysis status and progress"""
    try:
        status = analysis_service.get_analysis_status(analysis_id)
        
        if not status:
            raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/results/{analysis_id}")
async def get_analysis_results(
    analysis_id: str,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    """Get analysis results"""
    try:
        # Check if analysis is completed
        status = analysis_service.get_analysis_status(analysis_id)
        if not status:
            raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
        
        if status.status != AnalysisStatus.COMPLETED:
            raise HTTPException(
                status_code=400, 
                detail=f"Analysis {analysis_id} is not completed yet (status: {status.status})"
            )
        
        # Get results
        results = analysis_service.get_analysis_results(analysis_id)
        if not results:
            raise HTTPException(status_code=404, detail=f"Results for analysis {analysis_id} not found")
        
        return results.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis results: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/search", response_model=SearchResponse)
async def search_entities(
    request: SearchRequest,
    search_service: SearchService = Depends(get_search_service)
):
    """Search for entities in analysis results"""
    try:
        results = await search_service.search(
            query=request.query,
            entity_type=request.entity_type,
            analysis_id=request.analysis_id
        )
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/analyze/{analysis_id}")
async def cancel_analysis(
    analysis_id: str,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    """Cancel a running analysis"""
    try:
        success = analysis_service.cancel_analysis(analysis_id)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found or cannot be cancelled")
        
        return {"message": f"Analysis {analysis_id} cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/analyses")
async def list_analyses(
    status: Optional[AnalysisStatus] = None,
    limit: int = 50,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    """List all analyses with optional status filter"""
    try:
        analyses = analysis_service.list_analyses(status=status, limit=limit)
        return {"analyses": analyses}
        
    except Exception as e:
        logger.error(f"Failed to list analyses: {e}")
        raise HTTPException(status_code=500, detail=str(e))