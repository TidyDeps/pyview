# PyView

Interactive Python dependency visualization with 5-layer analysis and WebGL interface.

## About

PyView is an enhanced version of [thebjorn/pydeps](https://github.com/thebjorn/pydeps) that provides:

### ✨ Current Features (Implemented)
- 🔍 **5-Layer Analysis Engine**: Package → Module → Class → Method → Field level dependency tracking
- 🧠 **AST-based Analysis**: Deep code structure understanding using Python's AST 
- 🔗 **Legacy Integration**: Seamless integration with existing pydeps functionality
- 🚀 **FastAPI Server**: REST API with real-time WebSocket progress updates
- 📊 **Comprehensive Testing**: Full unit test coverage with 27 test files
- ⚡ **Parallel Processing**: Multi-worker analysis for performance

### 🔮 Planned Features  
- 🌐 **Interactive WebGL Visualization**: High-performance graph rendering
- 🔍 **Real-time Search Interface**: Navigate large codebases efficiently  
- 💻 **React Frontend**: Modern web interface with responsive design
- 📱 **Progressive Web App**: Offline-capable local analysis tool

⚠️ **Development Status**: Backend engine complete, frontend in development.

## Installation

**For Development:**
```bash
git clone https://github.com/yourusername/pyview.git
cd pyview
pip install -e .
```

**For End Users (when released):**
```bash
pip install pyview
```

## Usage

### 🔬 Backend Analysis Engine
```python
from pyview import analyze_project

# Analyze a Python project
result = analyze_project('/path/to/project')

# Access 5-layer analysis data
print(f"Packages: {len(result.dependency_graph.packages)}")
print(f"Modules: {len(result.dependency_graph.modules)}")  
print(f"Classes: {len(result.dependency_graph.classes)}")
print(f"Methods: {len(result.dependency_graph.methods)}")
print(f"Fields: {len(result.dependency_graph.fields)}")

# Export to JSON
with open('analysis.json', 'w') as f:
    f.write(result.to_json())
```

### 🌐 FastAPI Server
```bash
# Start the API server
python -m pyview.server.main --host 0.0.0.0 --port 8000

# Or run demo
python demo_server.py --start
```

**API Endpoints:**
- `POST /api/analyze` - Start dependency analysis
- `GET /api/analyze/{id}` - Get analysis status
- `GET /api/results/{id}` - Get analysis results  
- `POST /api/search` - Search entities
- `WS /ws/progress/{id}` - Real-time progress updates
- View docs at: `http://localhost:8000/docs`

### 🖥️ CLI (Legacy pydeps compatibility)
```bash
# Generate static dependency graph (coming soon)
pyview <module_name>
```

## License

This project is licensed under the BSD 2-Clause License - see the [LICENSE](LICENSE) file for details.

## Attribution

This project is based on the original pydeps project by Bjorn Pettersen:
- Original repository: https://github.com/thebjorn/pydeps
- Licensed under BSD 2-Clause License
- Copyright (c) 2014, Bjorn