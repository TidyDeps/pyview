# PyView

Interactive Python module dependency visualization with WebGL.

## About

PyView is an enhanced version of [thebjorn/pydeps](https://github.com/thebjorn/pydeps) that adds:
- 🚀 **Interactive WebGL visualization** for large codebases (10,000+ modules)
- 📊 **Multi-layer analysis** (Package → Module → Class → Method → Field)
- 🔍 **Real-time search and navigation**
- 💻 **Local web interface** (no server required)

⚠️ **Development Status**: This project is currently under active development.

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

**Planned Features:**
```bash
# Launch interactive web interface (coming soon)
pyview serve <project_path>
```

## License

This project is licensed under the BSD 2-Clause License - see the [LICENSE](LICENSE) file for details.

## Attribution

This project is based on the original pydeps project by Bjorn Pettersen:
- Original repository: https://github.com/thebjorn/pydeps
- Licensed under BSD 2-Clause License
- Copyright (c) 2014, Bjorn