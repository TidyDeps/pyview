#!/usr/bin/env python3
"""
PyView FastAPI Server Demo

Demonstrates the PyView API server functionality.
"""

import asyncio
import json
import sys
import os
from pathlib import Path

# Add pyview to path for import
sys.path.insert(0, os.path.dirname(__file__))

try:
    from pyview.server.app import create_app
    from pyview.server.main import run_server
    print("✅ FastAPI server imports successful")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    print("Run: pip install fastapi uvicorn pydantic")
    sys.exit(1)


def test_app_creation():
    """Test FastAPI app creation"""
    print("\n🧪 Testing FastAPI app creation...")
    
    try:
        app = create_app()
        print(f"✅ App created successfully")
        print(f"   Title: {app.title}")
        print(f"   Version: {app.version}")
        print(f"   Docs URL: {app.docs_url}")
        return True
    except Exception as e:
        print(f"❌ App creation failed: {e}")
        return False


async def test_api_routes():
    """Test API route structure"""
    print("\n🔗 Testing API routes...")
    
    try:
        app = create_app()
        
        # Get all routes
        routes = []
        for route in app.routes:
            if hasattr(route, 'path'):
                routes.append({
                    'path': route.path,
                    'methods': getattr(route, 'methods', ['N/A'])
                })
        
        print("📋 Available routes:")
        for route in sorted(routes, key=lambda x: x['path']):
            methods = ', '.join(sorted(route['methods']) if isinstance(route['methods'], set) else route['methods'])
            print(f"   {route['path']} [{methods}]")
        
        return True
    except Exception as e:
        print(f"❌ Route testing failed: {e}")
        return False


def show_server_info():
    """Show server information"""
    print("\n🚀 PyView FastAPI Server Information")
    print("=" * 50)
    print("📡 Server endpoints:")
    print("   • Root: http://localhost:8000/")
    print("   • Health: http://localhost:8000/health")
    print("   • API Docs: http://localhost:8000/docs")
    print("   • ReDoc: http://localhost:8000/redoc")
    print()
    print("🔌 API endpoints:")
    print("   • POST /api/analyze - Start analysis")
    print("   • GET /api/analyze/{id} - Get analysis status")
    print("   • GET /api/results/{id} - Get analysis results")
    print("   • POST /api/search - Search entities")
    print("   • DELETE /api/analyze/{id} - Cancel analysis")
    print("   • GET /api/analyses - List all analyses")
    print()
    print("🌐 WebSocket endpoints:")
    print("   • WS /ws/progress/{id} - Real-time progress updates")
    print()
    print("🎯 Usage:")
    print("   python demo_server.py --start    # Start the server")
    print("   python demo_server.py --test     # Run tests only")


async def main():
    """Main demo function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="PyView FastAPI Server Demo")
    parser.add_argument("--start", action="store_true", help="Start the server")
    parser.add_argument("--test", action="store_true", help="Run tests only")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    args = parser.parse_args()
    
    print("🎉 PyView FastAPI Server Demo")
    print("=" * 40)
    
    # Run tests
    if not args.start:
        success = True
        success &= test_app_creation()
        success &= await test_api_routes()
        
        if success:
            print("\n✅ All tests passed!")
            show_server_info()
        else:
            print("\n❌ Some tests failed!")
            return 1
    
    # Start server if requested
    if args.start:
        print(f"\n🚀 Starting server on {args.host}:{args.port}...")
        print("   Press Ctrl+C to stop")
        
        try:
            run_server(host=args.host, port=args.port, reload=args.reload)
        except KeyboardInterrupt:
            print("\n👋 Server stopped")
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)