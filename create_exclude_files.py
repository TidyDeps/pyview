import os

base_path = "/Users/taegwon/Desktop/pyview/TestProject/exclude_test"

# Files that should be included
files_to_create = [
    # Source files (should be included)
    ("src/core.py", '''"""Core module"""

class CoreModule:
    def process(self):
        return "Core processing"
'''),
    ("src/utils.py", '''"""Utility module"""

class UtilityModule:
    def helper(self):
        return "Helper function"
'''),
    ("src/__init__.py", "# Source package"),

    # Test files (commonly excluded)
    ("tests/test_main.py", '''"""Test file"""

def test_main():
    pass
'''),
    ("tests/__init__.py", "# Test package"),
    
    # Build/temp files (should be excluded)
    ("temp_files/cache.tmp", "temporary data"),
    ("temp_files/session.temp", "session data"),
    ("backup_dir/backup.bak", "backup data"),
    ("build/output.o", "compiled output"),
    ("dist/package.whl", "distribution package"),
    ("__pycache__/main.cpython-39.pyc", "compiled python"),
    ("node_modules/package.json", '{"name": "test"}'),
    (".git/config", "[core]"),
    
    # __init__.py files
    ("__init__.py", "# Package init"),
]

for filepath, content in files_to_create:
    full_path = os.path.join(base_path, filepath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w') as f:
        f.write(content)
    print(f"Created {filepath}")
    
# Create some *.pyc files
pyc_files = ["cache1.pyc", "cache2.pyc", "compiled.pyc"]
for pyc in pyc_files:
    with open(os.path.join(base_path, "__pycache__", pyc), 'w') as f:
        f.write("compiled bytecode")
    print(f"Created __pycache__/{pyc}")
