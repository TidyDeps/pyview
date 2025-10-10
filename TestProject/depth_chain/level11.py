"""Level 11 - Level11Logger in dependency chain"""

from .level12 import Level12Utils


class Level11Logger:
    def __init__(self):
        self.next = Level12Utils()

    def log_level11(self):
        """Process at level 11"""
        return self.next.util_level12()
