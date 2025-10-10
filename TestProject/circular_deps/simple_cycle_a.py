"""Simple A->B->A circular dependency"""

from .simple_cycle_b import ClassB


class ClassA:
    def __init__(self):
        self.b_instance = ClassB()

    def process_with_b(self):
        return self.b_instance.get_data()