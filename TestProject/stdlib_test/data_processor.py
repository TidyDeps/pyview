"""Data processor using standard library modules"""

import re
import collections
import itertools
import random
import hashlib
from typing import List, Dict, Any


class DataProcessor:
    def __init__(self):
        self.counter = collections.Counter()

    def validate_email(self, email):
        """Validate email using regex"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None

    def count_items(self, items):
        """Count items using collections.Counter"""
        self.counter.update(items)
        return dict(self.counter)

    def group_data(self, data, key_func):
        """Group data using itertools.groupby"""
        sorted_data = sorted(data, key=key_func)
        return {k: list(g) for k, g in itertools.groupby(sorted_data, key_func)}

    def generate_sample(self, population, k=5):
        """Generate random sample"""
        return random.sample(population, min(k, len(population)))

    def calculate_hash(self, text):
        """Calculate hash using hashlib"""
        return hashlib.md5(text.encode()).hexdigest()

    def flatten_list(self, nested_list):
        """Flatten nested list using itertools"""
        return list(itertools.chain.from_iterable(nested_list))