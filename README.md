# PyView

Interactive Python module dependency visualization with modern web interface.

## About

PyView is an enhanced version of [thebjorn/pydeps](https://github.com/thebjorn/pydeps) that adds:
- 🎨 **Interactive 2D network visualization** with Cytoscape.js for large codebases
- 📊 **5-layer analysis** (Package → Module → Class → Method → Field)
- 🔍 **Real-time search and navigation** across all entity types
- 🌐 **Modern web interface** with React + TypeScript + FastAPI
- 📡 **Real-time progress updates** via WebSocket

✅ **Development Status**: Phase 2 Complete - Fully functional system ready for use!

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

**Current CLI (compatible with pydeps):**
```bash
# Generate static dependency graph
pydeps <module_name>
pyview <module_name>  # same as above
```

**New Interactive Web Interface:**
```bash
# Launch backend server
cd server && python app.py

# Launch frontend (in separate terminal)
cd frontend && npm install && npm run dev

# Open browser: http://localhost:3000
```

## License

This project is licensed under the BSD 2-Clause License - see the [LICENSE](LICENSE) file for details.

## Attribution

This project is based on the original pydeps project by Bjorn Pettersen:
- Original repository: https://github.com/thebjorn/pydeps
- Licensed under BSD 2-Clause License
- Copyright (c) 2014, Bjorn