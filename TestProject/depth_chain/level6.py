"""Level 6 - Level6Engine in dependency chain"""

from .level7 import Level7Controller


class Level6Engine:
    def __init__(self):
        self.next = Level7Controller()

    def run_level6(self):
        """Process at level 6"""
        return self.next.control_level7()
