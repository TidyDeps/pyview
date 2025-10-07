"""Level 5 - Level5Service in dependency chain"""

from .level6 import Level6Engine


class Level5Service:
    def __init__(self):
        self.next = Level6Engine()

    def serve_level5(self):
        """Process at level 5"""
        return self.next.run_level6()
