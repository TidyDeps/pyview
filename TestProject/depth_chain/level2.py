"""Level 2 - Second level in dependency chain"""

from .level3 import Level3Processor


class Level2Handler:
    def __init__(self):
        self.processor = Level3Processor()

    def process_level2(self):
        """Process at level 2"""
        return self.processor.execute_level3()