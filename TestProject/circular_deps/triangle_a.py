"""Triangle A->B->C->A circular dependency"""

from .triangle_b import TriangleB


class TriangleA:
    def __init__(self):
        self.b = TriangleB()

    def process(self):
        return f"A -> {self.b.process()}"