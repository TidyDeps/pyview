"""Level 9 - Level9Repository in dependency chain"""

from .level10 import Level10Cache


class Level9Repository:
    def __init__(self):
        self.next = Level10Cache()

    def fetch_level9(self):
        """Process at level 9"""
        return self.next.get_level10()
