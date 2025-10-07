"""Simple B->A circular dependency"""

from .simple_cycle_a import ClassA


class ClassB:
    def __init__(self):
        pass

    def get_data(self):
        return "data from B"

    def use_a(self):
        a_instance = ClassA()
        return a_instance.process_with_b()