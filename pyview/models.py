"""
PyView 5-Layer Data Models

Defines the data structures for PyView's 5-layer dependency analysis:
Package → Module → Class → Method → Field
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Set
from enum import Enum
import json
from datetime import datetime


class DependencyType(Enum):
    """Types of dependencies between entities"""
    IMPORT = "import"
    INHERITANCE = "inheritance"
    COMPOSITION = "composition"
    CALL = "call"
    REFERENCE = "reference"
    ATTRIBUTE_ACCESS = "attribute"


class EntityType(Enum):
    """Types of code entities"""
    PACKAGE = "package"
    MODULE = "module"
    CLASS = "class"
    METHOD = "method"
    FIELD = "field"
    FUNCTION = "function"


@dataclass
class ImportInfo:
    """Information about an import statement"""
    module: str
    name: Optional[str] = None
    alias: Optional[str] = None
    line_number: int = 0
    import_type: str = "import"  # "import" or "from_import"
    is_relative: bool = False


@dataclass
class FieldInfo:
    """Information about a class field/attribute"""
    id: str
    name: str
    class_id: str
    line_number: int
    file_path: str
    type_annotation: Optional[str] = None
    default_value: Optional[str] = None
    is_class_variable: bool = False
    docstring: Optional[str] = None


@dataclass
class MethodInfo:
    """Information about a method or function"""
    id: str
    name: str
    line_number: int
    file_path: str
    class_id: Optional[str] = None  # None for module-level functions
    args: List[str] = field(default_factory=list)
    return_annotation: Optional[str] = None
    decorators: List[str] = field(default_factory=list)
    is_method: bool = False
    is_static: bool = False
    is_class_method: bool = False
    is_property: bool = False
    calls: List[str] = field(default_factory=list)  # IDs of called methods/functions
    complexity: int = 1  # Cyclomatic complexity
    docstring: Optional[str] = None


@dataclass
class ClassInfo:
    """Information about a class definition"""
    id: str
    name: str
    module_id: str
    line_number: int
    file_path: str
    bases: List[str] = field(default_factory=list)  # Base class IDs
    methods: List[str] = field(default_factory=list)  # Method IDs
    fields: List[str] = field(default_factory=list)  # Field IDs
    decorators: List[str] = field(default_factory=list)
    is_abstract: bool = False
    docstring: Optional[str] = None


@dataclass
class ModuleInfo:
    """Information about a Python module"""
    id: str
    name: str
    file_path: str
    package_id: Optional[str] = None
    classes: List[str] = field(default_factory=list)  # Class IDs
    functions: List[str] = field(default_factory=list)  # Function IDs
    imports: List[ImportInfo] = field(default_factory=list)
    loc: int = 0  # Lines of Code
    docstring: Optional[str] = None


@dataclass
class PackageInfo:
    """Information about a Python package"""
    id: str
    name: str
    path: str
    modules: List[str] = field(default_factory=list)  # Module IDs
    sub_packages: List[str] = field(default_factory=list)  # Sub-package IDs
    is_namespace: bool = False
    version: Optional[str] = None


@dataclass
class Relationship:
    """A dependency relationship between two entities"""
    id: str
    from_entity: str  # Entity ID
    to_entity: str    # Entity ID
    relationship_type: DependencyType
    line_number: int
    file_path: str
    strength: float = 1.0  # Relationship strength (0.0 - 1.0)
    context: Optional[str] = None  # Additional context


@dataclass
class ComplexityMetrics:
    """Code complexity metrics"""
    cyclomatic_complexity: Dict[str, int] = field(default_factory=dict)
    cognitive_complexity: Dict[str, int] = field(default_factory=dict)
    nesting_depth: Dict[str, int] = field(default_factory=dict)
    lines_of_code: Dict[str, int] = field(default_factory=dict)


@dataclass
class CouplingMetrics:
    """Coupling and cohesion metrics"""
    afferent_coupling: Dict[str, int] = field(default_factory=dict)  # Incoming dependencies
    efferent_coupling: Dict[str, int] = field(default_factory=dict)  # Outgoing dependencies
    instability: Dict[str, float] = field(default_factory=dict)  # I = Ce / (Ca + Ce)
    abstractness: Dict[str, float] = field(default_factory=dict)  # A = Abstract classes / Total classes


@dataclass
class CyclicDependency:
    """Information about a cyclic dependency"""
    id: str
    entities: List[str]  # Entity IDs forming the cycle
    cycle_type: str  # "import", "inheritance", "call"
    severity: str = "medium"  # "low", "medium", "high"
    description: Optional[str] = None


@dataclass
class DependencyGraph:
    """The complete dependency graph structure"""
    packages: List[PackageInfo] = field(default_factory=list)
    modules: List[ModuleInfo] = field(default_factory=list)
    classes: List[ClassInfo] = field(default_factory=list)
    methods: List[MethodInfo] = field(default_factory=list)
    fields: List[FieldInfo] = field(default_factory=list)
    
    # Quick lookup maps
    _packages_map: Dict[str, PackageInfo] = field(default_factory=dict, init=False)
    _modules_map: Dict[str, ModuleInfo] = field(default_factory=dict, init=False)
    _classes_map: Dict[str, ClassInfo] = field(default_factory=dict, init=False)
    _methods_map: Dict[str, MethodInfo] = field(default_factory=dict, init=False)
    _fields_map: Dict[str, FieldInfo] = field(default_factory=dict, init=False)

    def __post_init__(self):
        """Build lookup maps after initialization"""
        self._build_lookup_maps()

    def _build_lookup_maps(self):
        """Build internal lookup maps for fast access"""
        self._packages_map = {pkg.id: pkg for pkg in self.packages}
        self._modules_map = {mod.id: mod for mod in self.modules}
        self._classes_map = {cls.id: cls for cls in self.classes}
        self._methods_map = {meth.id: meth for meth in self.methods}
        self._fields_map = {field.id: field for field in self.fields}

    def get_entity(self, entity_id: str) -> Optional[Any]:
        """Get any entity by its ID"""
        if entity_id in self._packages_map:
            return self._packages_map[entity_id]
        elif entity_id in self._modules_map:
            return self._modules_map[entity_id]
        elif entity_id in self._classes_map:
            return self._classes_map[entity_id]
        elif entity_id in self._methods_map:
            return self._methods_map[entity_id]
        elif entity_id in self._fields_map:
            return self._fields_map[entity_id]
        return None

    def add_package(self, package: PackageInfo):
        """Add a package to the graph"""
        self.packages.append(package)
        self._packages_map[package.id] = package

    def add_module(self, module: ModuleInfo):
        """Add a module to the graph"""
        self.modules.append(module)
        self._modules_map[module.id] = module

    def add_class(self, class_info: ClassInfo):
        """Add a class to the graph"""
        self.classes.append(class_info)
        self._classes_map[class_info.id] = class_info

    def add_method(self, method: MethodInfo):
        """Add a method to the graph"""
        self.methods.append(method)
        self._methods_map[method.id] = method

    def add_field(self, field_info: FieldInfo):
        """Add a field to the graph"""
        self.fields.append(field_info)
        self._fields_map[field_info.id] = field_info


@dataclass
class ProjectInfo:
    """Information about the analyzed project"""
    name: str
    path: str
    analyzed_at: str
    total_files: int
    analysis_duration_seconds: float
    python_version: Optional[str] = None
    analysis_options: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnalysisResult:
    """Complete analysis result for a Python project"""
    analysis_id: str
    project_info: ProjectInfo
    dependency_graph: DependencyGraph
    relationships: List[Relationship] = field(default_factory=list)
    metrics: Optional[Dict[str, Any]] = None
    cycles: List[CyclicDependency] = field(default_factory=list)
    
    # Analysis metadata
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        def _convert_dataclass(obj):
            if hasattr(obj, '__dataclass_fields__'):
                result = {}
                for key, value in obj.__dict__.items():
                    if key.startswith('_'):  # Skip private attributes
                        continue
                    if isinstance(value, list):
                        result[key] = [_convert_dataclass(item) for item in value]
                    elif isinstance(value, dict):
                        result[key] = {k: _convert_dataclass(v) for k, v in value.items()}
                    elif isinstance(value, Enum):
                        result[key] = value.value
                    elif hasattr(value, '__dataclass_fields__'):
                        result[key] = _convert_dataclass(value)
                    else:
                        result[key] = value
                return result
            else:
                return obj
        
        return _convert_dataclass(self)
    
    def to_json(self, indent: int = 2) -> str:
        """Convert to JSON string"""
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)
    
    def get_entity_count(self) -> Dict[str, int]:
        """Get count of each entity type"""
        return {
            "packages": len(self.dependency_graph.packages),
            "modules": len(self.dependency_graph.modules),
            "classes": len(self.dependency_graph.classes),
            "methods": len(self.dependency_graph.methods),
            "fields": len(self.dependency_graph.fields),
            "relationships": len(self.relationships),
            "cycles": len(self.cycles)
        }
    
    def get_relationships_by_type(self, rel_type: DependencyType) -> List[Relationship]:
        """Get relationships of a specific type"""
        return [rel for rel in self.relationships if rel.relationship_type == rel_type]
    
    def get_entity_relationships(self, entity_id: str) -> List[Relationship]:
        """Get all relationships involving a specific entity"""
        return [rel for rel in self.relationships 
                if rel.from_entity == entity_id or rel.to_entity == entity_id]


# Factory functions for creating IDs
def create_package_id(package_path: str) -> str:
    """Create a unique package ID from package path"""
    return f"pkg:{package_path.replace('/', '.').replace('\\', '.')}"


def create_module_id(module_path: str) -> str:
    """Create a unique module ID from module file path"""
    # Convert file path to module name
    module_name = module_path.replace('/', '.').replace('\\', '.')
    if module_name.endswith('.py'):
        module_name = module_name[:-3]
    return f"mod:{module_name}"


def create_class_id(module_id: str, class_name: str) -> str:
    """Create a unique class ID"""
    return f"cls:{module_id}:{class_name}"


def create_method_id(class_id: Optional[str], method_name: str, line_number: int = 0) -> str:
    """Create a unique method ID"""
    if class_id:
        return f"meth:{class_id}:{method_name}:{line_number}"
    else:
        # Module-level function
        return f"func:{method_name}:{line_number}"


def create_field_id(class_id: str, field_name: str) -> str:
    """Create a unique field ID"""
    return f"field:{class_id}:{field_name}"


def create_relationship_id(from_entity: str, to_entity: str, rel_type: DependencyType) -> str:
    """Create a unique relationship ID"""
    return f"rel:{from_entity}->{to_entity}:{rel_type.value}"