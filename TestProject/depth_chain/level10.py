"""Level 10 - Level10Cache in dependency chain"""

from .level11 import Level11Logger


class Level10Cache:
    def __init__(self):
        self.next = Level11Logger()

    def get_level10(self):
        """Process at level 10"""
        return self.next.log_level11()
