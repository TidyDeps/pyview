"""
WebSocket Routes

Real-time progress updates for analysis jobs.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import logging
import asyncio

from .models import ProgressUpdate


logger = logging.getLogger(__name__)
websocket_router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        # analysis_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, analysis_id: str):
        """Connect a websocket to analysis updates"""
        await websocket.accept()
        
        async with self._lock:
            if analysis_id not in self.active_connections:
                self.active_connections[analysis_id] = set()
            self.active_connections[analysis_id].add(websocket)
        
        logger.info(f"WebSocket connected for analysis {analysis_id}")
    
    async def disconnect(self, websocket: WebSocket, analysis_id: str):
        """Disconnect a websocket"""
        async with self._lock:
            if analysis_id in self.active_connections:
                self.active_connections[analysis_id].discard(websocket)
                
                # Clean up empty analysis connections
                if not self.active_connections[analysis_id]:
                    del self.active_connections[analysis_id]
        
        logger.info(f"WebSocket disconnected for analysis {analysis_id}")
    
    async def broadcast_to_analysis(self, analysis_id: str, data: dict):
        """Broadcast data to all connections for an analysis"""
        if analysis_id not in self.active_connections:
            return
        
        connections = self.active_connections[analysis_id].copy()
        message = json.dumps(data)
        
        disconnected = []
        
        for websocket in connections:
            try:
                await websocket.send_text(message)
            except:
                disconnected.append(websocket)
        
        # Clean up disconnected websockets
        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    self.active_connections[analysis_id].discard(ws)
                
                if not self.active_connections[analysis_id]:
                    del self.active_connections[analysis_id]
    
    def get_connection_count(self, analysis_id: str) -> int:
        """Get number of active connections for analysis"""
        return len(self.active_connections.get(analysis_id, set()))


# Global connection manager
manager = ConnectionManager()


@websocket_router.websocket("/progress/{analysis_id}")
async def websocket_progress(websocket: WebSocket, analysis_id: str):
    """WebSocket endpoint for real-time progress updates"""
    await manager.connect(websocket, analysis_id)
    
    try:
        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connection",
            "analysis_id": analysis_id,
            "message": "Connected to progress updates"
        }))
        
        # Keep connection alive and listen for disconnection
        while True:
            try:
                # Wait for any client message (heartbeat, etc.)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                
                # Echo heartbeat if received
                if data.strip().lower() == "ping":
                    await websocket.send_text("pong")
                    
            except asyncio.TimeoutError:
                # Send heartbeat to check if connection is alive
                await websocket.send_text(json.dumps({
                    "type": "heartbeat",
                    "analysis_id": analysis_id
                }))
                
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from analysis {analysis_id}")
    except Exception as e:
        logger.error(f"WebSocket error for analysis {analysis_id}: {e}")
    finally:
        await manager.disconnect(websocket, analysis_id)


async def broadcast_progress_update(update: ProgressUpdate):
    """Broadcast progress update to connected clients"""
    data = {
        "type": "progress",
        **update.dict()
    }
    await manager.broadcast_to_analysis(update.analysis_id, data)


async def broadcast_analysis_complete(analysis_id: str, success: bool, message: str = ""):
    """Broadcast analysis completion to connected clients"""
    data = {
        "type": "complete",
        "analysis_id": analysis_id,
        "success": success,
        "message": message
    }
    await manager.broadcast_to_analysis(analysis_id, data)


async def broadcast_analysis_error(analysis_id: str, error: str):
    """Broadcast analysis error to connected clients"""
    data = {
        "type": "error", 
        "analysis_id": analysis_id,
        "error": error
    }
    await manager.broadcast_to_analysis(analysis_id, data)


# Export the manager for use in services
__all__ = ["websocket_router", "manager", "broadcast_progress_update", "broadcast_analysis_complete", "broadcast_analysis_error"]