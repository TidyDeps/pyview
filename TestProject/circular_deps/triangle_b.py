"""Triangle B->C circular dependency"""

from .triangle_c import TriangleC


class TriangleB:
    def __init__(self):
        self.c = TriangleC()

    def process(self):
        return f"B -> {self.c.process()}"