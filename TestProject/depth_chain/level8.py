"""Level 8 - Level8Validator in dependency chain"""

from .level9 import Level9Repository


class Level8Validator:
    def __init__(self):
        self.next = Level9Repository()

    def validate_level8(self):
        """Process at level 8"""
        return self.next.fetch_level9()
