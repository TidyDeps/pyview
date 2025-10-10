"""File handler using standard library modules"""

import os
import json
import datetime
from pathlib import Path


class FileHandler:
    def __init__(self):
        self.base_path = Path.cwd()

    def read_file(self, filename):
        """Read file using os and pathlib"""
        file_path = self.base_path / filename
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                return f.read()
        return None

    def write_json(self, data, filename):
        """Write JSON file"""
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)

    def get_file_info(self, filename):
        """Get file info using os"""
        stat = os.stat(filename)
        return {
            'size': stat.st_size,
            'modified': datetime.datetime.fromtimestamp(stat.st_mtime),
            'created': datetime.datetime.fromtimestamp(stat.st_ctime)
        }