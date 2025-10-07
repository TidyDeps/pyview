"""Deep 4-node circular dependency: 1->2->3->4->1"""

from .deep_cycle_2 import DeepCycle2


class DeepCycle1:
    def __init__(self):
        self.next = DeepCycle2()

    def execute(self):
        return f"1 -> {self.next.execute()}"