"""Deep cycle 3->4"""

from .deep_cycle_4 import DeepCycle4


class DeepCycle3:
    def __init__(self):
        self.next = DeepCycle4()

    def execute(self):
        return f"3 -> {self.next.execute()}"