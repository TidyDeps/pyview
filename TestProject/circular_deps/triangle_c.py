"""Triangle C->A circular dependency"""

from .triangle_a import TriangleA


class TriangleC:
    def __init__(self):
        pass

    def process(self):
        return "C"

    def use_a(self):
        a = TriangleA()
        return a.process()