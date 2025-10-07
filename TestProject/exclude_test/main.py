"""Main module for exclude patterns testing"""

from .src.core import CoreModule
from .src.utils import UtilityModule


class MainApp:
    def __init__(self):
        self.core = CoreModule()
        self.utils = UtilityModule()

    def run(self):
        return self.core.process() + self.utils.helper()