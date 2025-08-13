"""
PyView FastAPI Server Main

Entry point for running the PyView API server.
"""

import uvicorn
import logging
from .app import create_app


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def run_server(host: str = "127.0.0.1", port: int = 8000, reload: bool = False):
    """Run the FastAPI server"""
    app = create_app()
    
    logger.info(f"Starting PyView API server on {host}:{port}")
    logger.info(f"API documentation will be available at http://{host}:{port}/docs")
    
    uvicorn.run(
        "pyview.server.app:create_app",
        host=host,
        port=port,
        reload=reload,
        factory=True
    )


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="PyView API Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    
    args = parser.parse_args()
    
    run_server(host=args.host, port=args.port, reload=args.reload)