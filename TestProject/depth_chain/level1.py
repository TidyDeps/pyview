"""Level 1 - Entry point for dependency chain"""

from .level2 import Level2Handler


class Level1Manager:
    def __init__(self):
        self.handler = Level2Handler()

    def start_process(self):
        """Start the processing chain"""
        return self.handler.process_level2()

def main():
    manager = Level1Manager()
    return manager.start_process()