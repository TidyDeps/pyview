"""Level 3 - Third level in dependency chain"""

from .level4 import Level4Worker


class Level3Processor:
    def __init__(self):
        self.worker = Level4Worker()

    def execute_level3(self):
        """Execute at level 3"""
        return self.worker.work_level4()