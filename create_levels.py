# Script to create remaining dependency chain levels

levels = [
    (5, "Level5Service", "serve_level5", "level6", "Level6Engine", "run_level6"),
    (6, "Level6Engine", "run_level6", "level7", "Level7Controller", "control_level7"),
    (7, "Level7Controller", "control_level7", "level8", "Level8Validator", "validate_level8"),
    (8, "Level8Validator", "validate_level8", "level9", "Level9Repository", "fetch_level9"),
    (9, "Level9Repository", "fetch_level9", "level10", "Level10Cache", "get_level10"),
    (10, "Level10Cache", "get_level10", "level11", "Level11Logger", "log_level11"),
    (11, "Level11Logger", "log_level11", "level12", "Level12Utils", "util_level12"),
    (12, "Level12Utils", "util_level12", None, None, None)
]

for level, class_name, method_name, next_level, next_class, next_method in levels:
    if next_level:
        content = f'''"""Level {level} - {class_name} in dependency chain"""

from .{next_level} import {next_class}


class {class_name}:
    def __init__(self):
        self.next = {next_class}()

    def {method_name}(self):
        """Process at level {level}"""
        return self.next.{next_method}()
'''
    else:
        # Final level
        content = f'''"""Level {level} - Final level in dependency chain"""


class {class_name}:
    def __init__(self):
        self.data = "Final result from level {level}"

    def {method_name}(self):
        """Final utility function at level {level}"""
        return self.data
'''
    
    with open(f'/Users/taegwon/Desktop/pyview/TestProject/depth_chain/level{level}.py', 'w') as f:
        f.write(content)
    
    print(f"Created level{level}.py")
