"""
Business Logic Services

Core services for analysis management and search functionality.
"""

import asyncio
import logging
import time
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import json

from .models import (
    AnalysisOptions as APIAnalysisOptions, 
    AnalysisStatus, 
    AnalysisStatusResponse,
    SearchResponse, 
    SearchResult,
    ProgressUpdate
)
from .websocket import broadcast_progress_update, broadcast_analysis_complete, broadcast_analysis_error
from ..analyzer_engine import analyze_project, AnalysisOptions, ProgressCallback
from ..models import AnalysisResult


logger = logging.getLogger(__name__)


class APIProgressCallback(ProgressCallback):
    """Progress callback that broadcasts updates via WebSocket"""
    
    def __init__(self, analysis_id: str):
        super().__init__()
        self.analysis_id = analysis_id
        
    def _default_callback(self, data: dict):
        """Send progress update via WebSocket"""
        try:
            update = ProgressUpdate(
                analysis_id=self.analysis_id,
                stage=data.get('stage', 'Processing'),
                progress=data.get('progress', 0.0),
                message=data.get('message', ''),
                current_file=data.get('current_file'),
                files_processed=data.get('files_processed'),
                total_files=data.get('total_files')
            )
            
            # Schedule the broadcast (non-blocking)
            asyncio.create_task(broadcast_progress_update(update))
            
        except Exception as e:
            logger.error(f"Failed to send progress update: {e}")


class AnalysisService:
    """Service for managing analysis jobs"""
    
    def __init__(self):
        self.analyses: Dict[str, AnalysisStatusResponse] = {}
        self.results: Dict[str, AnalysisResult] = {}
        self.executor = ThreadPoolExecutor(max_workers=4)
    
    async def run_analysis(self, analysis_id: str, project_path: str, options: APIAnalysisOptions):
        """Run analysis in background"""
        
        # Create initial status
        now = datetime.now(timezone.utc).isoformat()
        status = AnalysisStatusResponse(
            analysis_id=analysis_id,
            status=AnalysisStatus.RUNNING,
            progress=0.0,
            message="Starting analysis...",
            created_at=now,
            updated_at=now
        )
        self.analyses[analysis_id] = status
        
        try:
            # Convert API options to analyzer options
            analyzer_options = AnalysisOptions(
                max_depth=options.max_depth,
                exclude_patterns=options.exclude_patterns,
                include_stdlib=options.include_stdlib,
                analysis_levels=options.analysis_levels,
                enable_type_inference=options.enable_type_inference,
                max_workers=options.max_workers
            )
            
            # Create progress callback
            progress_callback = APIProgressCallback(analysis_id)
            
            # Run analysis in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                analyze_project,
                project_path,
                analyzer_options,
                progress_callback
            )
            
            # Update status to completed
            self.analyses[analysis_id].status = AnalysisStatus.COMPLETED
            self.analyses[analysis_id].progress = 100.0
            self.analyses[analysis_id].message = "Analysis completed successfully"
            self.analyses[analysis_id].updated_at = datetime.now(timezone.utc).isoformat()
            
            # Store results
            self.results[analysis_id] = result
            
            # Broadcast completion
            await broadcast_analysis_complete(
                analysis_id, 
                success=True, 
                message="Analysis completed successfully"
            )
            
            logger.info(f"Analysis {analysis_id} completed successfully")
            
        except Exception as e:
            # Update status to failed
            error_message = str(e)
            self.analyses[analysis_id].status = AnalysisStatus.FAILED
            self.analyses[analysis_id].message = f"Analysis failed: {error_message}"
            self.analyses[analysis_id].error = error_message
            self.analyses[analysis_id].updated_at = datetime.now(timezone.utc).isoformat()
            
            # Broadcast error
            await broadcast_analysis_error(analysis_id, error_message)
            
            logger.error(f"Analysis {analysis_id} failed: {e}")
    
    def get_analysis_status(self, analysis_id: str) -> Optional[AnalysisStatusResponse]:
        """Get analysis status"""
        return self.analyses.get(analysis_id)
    
    def get_analysis_results(self, analysis_id: str) -> Optional[AnalysisResult]:
        """Get analysis results"""
        return self.results.get(analysis_id)
    
    def cancel_analysis(self, analysis_id: str) -> bool:
        """Cancel running analysis"""
        if analysis_id not in self.analyses:
            return False
        
        status = self.analyses[analysis_id]
        if status.status not in [AnalysisStatus.PENDING, AnalysisStatus.RUNNING]:
            return False
        
        # Update status
        status.status = AnalysisStatus.FAILED
        status.message = "Analysis cancelled by user"
        status.error = "Cancelled"
        status.updated_at = datetime.now(timezone.utc).isoformat()
        
        logger.info(f"Analysis {analysis_id} cancelled")
        return True
    
    def list_analyses(self, status: Optional[AnalysisStatus] = None, limit: int = 50) -> List[AnalysisStatusResponse]:
        """List analyses with optional status filter"""
        analyses = list(self.analyses.values())
        
        if status:
            analyses = [a for a in analyses if a.status == status]
        
        # Sort by creation time (newest first)
        analyses.sort(key=lambda x: x.created_at, reverse=True)
        
        return analyses[:limit]


class SearchService:
    """Service for searching entities in analysis results"""
    
    def __init__(self):
        self.analysis_service = AnalysisService()
    
    async def search(
        self, 
        query: str, 
        entity_type: Optional[str] = None,
        analysis_id: Optional[str] = None
    ) -> SearchResponse:
        """Search for entities"""
        
        results = []
        
        if analysis_id:
            # Search within specific analysis
            analysis_result = self.analysis_service.get_analysis_results(analysis_id)
            if analysis_result:
                results.extend(self._search_in_result(analysis_result, query, entity_type))
        else:
            # Search across all completed analyses
            for aid, analysis_result in self.analysis_service.results.items():
                results.extend(self._search_in_result(analysis_result, query, entity_type))
        
        return SearchResponse(
            query=query,
            total_results=len(results),
            results=results[:100]  # Limit results
        )
    
    def _search_in_result(
        self, 
        result: AnalysisResult, 
        query: str, 
        entity_type: Optional[str]
    ) -> List[SearchResult]:
        """Search within a single analysis result"""
        
        matches = []
        query_lower = query.lower()
        
        # Search modules
        if not entity_type or entity_type == "module":
            for module in result.dependency_graph.modules:
                if query_lower in module.name.lower():
                    matches.append(SearchResult(
                        name=module.name,
                        entity_type="module",
                        module_path=module.name,
                        file_path=module.file_path,
                        line_number=1,
                        description=module.docstring[:100] if module.docstring else None
                    ))
        
        # Search classes
        if not entity_type or entity_type == "class":
            for class_info in result.dependency_graph.classes:
                if query_lower in class_info.name.lower():
                    matches.append(SearchResult(
                        name=class_info.name,
                        entity_type="class",
                        module_path=class_info.module_id,
                        file_path=class_info.file_path,
                        line_number=class_info.line_number,
                        description=class_info.docstring[:100] if class_info.docstring else None
                    ))
        
        # Search methods
        if not entity_type or entity_type == "method":
            for method in result.dependency_graph.methods:
                if query_lower in method.name.lower():
                    matches.append(SearchResult(
                        name=method.name,
                        entity_type="method",
                        module_path=method.class_id or "global",
                        file_path=method.file_path,
                        line_number=method.line_number,
                        description=method.docstring[:100] if method.docstring else None
                    ))
        
        return matches