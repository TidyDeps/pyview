"""Level 4 - Fourth level in dependency chain"""

from .level5 import Level5Service


class Level4Worker:
    def __init__(self):
        self.service = Level5Service()

    def work_level4(self):
        """Work at level 4"""
        return self.service.serve_level5()