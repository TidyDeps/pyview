"""Deep cycle 4->1 completes the circle"""

from .deep_cycle_1 import DeepCycle1


class DeepCycle4:
    def __init__(self):
        pass

    def execute(self):
        return "4"

    def back_to_start(self):
        start = DeepCycle1()
        return start.execute()