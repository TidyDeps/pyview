"""Level 7 - Level7Controller in dependency chain"""

from .level8 import Level8Validator


class Level7Controller:
    def __init__(self):
        self.next = Level8Validator()

    def control_level7(self):
        """Process at level 7"""
        return self.next.validate_level8()
