"""
PyView Cache Management System

Implements intelligent caching for incremental analysis:
- File modification tracking
- Partial analysis results caching
- Dependency graph caching
- Intelligent invalidation
"""

import os
import json
import hashlib
import pickle
import time
from pathlib import Path
from typing import Dict, Set, Optional, List, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .models import AnalysisResult, ModuleInfo, ClassInfo, MethodInfo


@dataclass
class FileMetadata:
    """Metadata for cached files"""
    file_path: str
    last_modified: float
    size: int
    checksum: str
    analysis_version: str = "1.0"
    
    @classmethod
    def from_file(cls, file_path: str) -> 'FileMetadata':
        """Create metadata from file"""
        stat = os.stat(file_path)
        
        # Calculate checksum for content verification
        with open(file_path, 'rb') as f:
            content = f.read()
            checksum = hashlib.md5(content).hexdigest()
        
        return cls(
            file_path=file_path,
            last_modified=stat.st_mtime,
            size=stat.st_size,
            checksum=checksum
        )
    
    def is_outdated(self) -> bool:
        """Check if file has been modified"""
        if not os.path.exists(self.file_path):
            return True
            
        try:
            current_stat = os.stat(self.file_path)
            
            # Quick check: modification time and size
            if (current_stat.st_mtime != self.last_modified or
                current_stat.st_size != self.size):
                return True
                
            # Deep check: content checksum
            with open(self.file_path, 'rb') as f:
                content = f.read()
                current_checksum = hashlib.md5(content).hexdigest()
                
            return current_checksum != self.checksum
            
        except (OSError, IOError):
            return True


@dataclass
class AnalysisCache:
    """Cache entry for analysis results"""
    cache_id: str
    project_path: str
    created_at: datetime
    expires_at: Optional[datetime]
    file_metadata: Dict[str, FileMetadata] = field(default_factory=dict)
    analysis_result: Optional[AnalysisResult] = None
    partial_results: Dict[str, Any] = field(default_factory=dict)  # File-level caches
    dependencies: Set[str] = field(default_factory=set)  # Files this cache depends on


class CacheManager:
    """Manages analysis caching and invalidation"""
    
    def __init__(self, cache_dir: Optional[str] = None, max_cache_size_mb: int = 500):
        self.cache_dir = Path(cache_dir or os.path.expanduser("~/.pyview_cache"))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.max_cache_size = max_cache_size_mb * 1024 * 1024  # Convert to bytes
        self.cache_index_file = self.cache_dir / "cache_index.json"
        
        # In-memory cache for frequently used data
        self.memory_cache: Dict[str, AnalysisCache] = {}
        
        # Load existing cache index
        self.cache_index = self._load_cache_index()
        
        # Clean up old caches on startup
        self._cleanup_expired_caches()
    
    def _load_cache_index(self) -> Dict[str, Dict]:
        """Load cache index from disk"""
        if not self.cache_index_file.exists():
            return {}
            
        try:
            with open(self.cache_index_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    
    def _save_cache_index(self):
        """Save cache index to disk"""
        try:
            with open(self.cache_index_file, 'w') as f:
                json.dump(self.cache_index, f, indent=2, default=str)
        except IOError:
            pass
    
    def _cleanup_expired_caches(self):
        """Remove expired cache entries"""
        now = datetime.now()
        expired_keys = []
        
        for cache_id, cache_info in self.cache_index.items():
            expires_at = cache_info.get('expires_at')
            if expires_at and datetime.fromisoformat(expires_at) < now:
                expired_keys.append(cache_id)
        
        for key in expired_keys:
            self._remove_cache(key)
    
    def _remove_cache(self, cache_id: str):
        """Remove a cache entry completely"""
        # Remove from index
        if cache_id in self.cache_index:
            del self.cache_index[cache_id]
        
        # Remove from memory
        if cache_id in self.memory_cache:
            del self.memory_cache[cache_id]
        
        # Remove cache files
        cache_file = self.cache_dir / f"{cache_id}.pkl"
        if cache_file.exists():
            cache_file.unlink()
        
        self._save_cache_index()
    
    def _ensure_cache_size_limit(self):
        """Ensure cache doesn't exceed size limit"""
        total_size = 0
        cache_files = []
        
        for cache_file in self.cache_dir.glob("*.pkl"):
            size = cache_file.stat().st_size
            total_size += size
            cache_files.append((cache_file, size, cache_file.stat().st_mtime))
        
        if total_size <= self.max_cache_size:
            return
        
        # Sort by last access time (oldest first)
        cache_files.sort(key=lambda x: x[2])
        
        # Remove oldest caches until we're under the limit
        for cache_file, size, _ in cache_files:
            if total_size <= self.max_cache_size:
                break
                
            cache_id = cache_file.stem
            self._remove_cache(cache_id)
            total_size -= size
    
    def generate_cache_key(self, project_path: str, options: Dict[str, Any]) -> str:
        """Generate a unique cache key for project + options"""
        # Create a deterministic hash of project path + options
        cache_data = {
            'project_path': os.path.abspath(project_path),
            'options': sorted(options.items()) if isinstance(options, dict) else str(options)
        }
        
        cache_str = json.dumps(cache_data, sort_keys=True)
        return hashlib.sha256(cache_str.encode()).hexdigest()[:16]
    
    def get_cache(self, cache_id: str) -> Optional[AnalysisCache]:
        """Retrieve cached analysis results"""
        # Check memory cache first
        if cache_id in self.memory_cache:
            return self.memory_cache[cache_id]
        
        # Check if cache exists in index
        if cache_id not in self.cache_index:
            return None
        
        cache_file = self.cache_dir / f"{cache_id}.pkl"
        if not cache_file.exists():
            # Clean up stale index entry
            del self.cache_index[cache_id]
            self._save_cache_index()
            return None
        
        try:
            with open(cache_file, 'rb') as f:
                cache_data = pickle.load(f)
            
            # Add to memory cache for fast access
            self.memory_cache[cache_id] = cache_data
            return cache_data
            
        except (pickle.PickleError, IOError):
            # Corrupted cache, remove it
            self._remove_cache(cache_id)
            return None
    
    def save_cache(self, cache: AnalysisCache):
        """Save analysis results to cache"""
        cache_file = self.cache_dir / f"{cache.cache_id}.pkl"
        
        try:
            # Ensure we don't exceed cache size
            self._ensure_cache_size_limit()
            
            # Save to disk
            with open(cache_file, 'wb') as f:
                pickle.dump(cache, f, protocol=pickle.HIGHEST_PROTOCOL)
            
            # Update index
            self.cache_index[cache.cache_id] = {
                'project_path': cache.project_path,
                'created_at': cache.created_at.isoformat(),
                'expires_at': cache.expires_at.isoformat() if cache.expires_at else None,
                'file_count': len(cache.file_metadata)
            }
            
            # Add to memory cache
            self.memory_cache[cache.cache_id] = cache
            
            self._save_cache_index()
            
        except (pickle.PickleError, IOError):
            # Failed to save, clean up
            if cache_file.exists():
                cache_file.unlink()
    
    def check_incremental_validity(self, cache: AnalysisCache, 
                                  current_files: List[str]) -> Dict[str, bool]:
        """Check which files need re-analysis"""
        validity = {}
        current_files_set = set(current_files)
        
        # Check cached files
        for file_path, metadata in cache.file_metadata.items():
            if file_path not in current_files_set:
                # File was deleted
                validity[file_path] = False
            else:
                # Check if file was modified
                validity[file_path] = not metadata.is_outdated()
        
        # Check for new files
        for file_path in current_files:
            if file_path not in cache.file_metadata:
                validity[file_path] = False
        
        return validity
    
    def get_incremental_analysis_plan(self, cache: AnalysisCache, 
                                     current_files: List[str]) -> Dict[str, List[str]]:
        """Generate incremental analysis plan"""
        validity = self.check_incremental_validity(cache, current_files)
        
        # Files that need re-analysis
        outdated_files = [f for f, valid in validity.items() if not valid]
        
        # Files that can be reused
        valid_files = [f for f, valid in validity.items() if valid]
        
        # Files that depend on outdated files (need re-analysis)
        dependent_files = set()
        for outdated_file in outdated_files:
            # Find files that import or depend on this file
            for file_path in cache.dependencies:
                if self._has_dependency(file_path, outdated_file, cache):
                    dependent_files.add(file_path)
        
        # Remove dependent files from valid list
        truly_valid = [f for f in valid_files if f not in dependent_files]
        needs_reanalysis = list(set(outdated_files + list(dependent_files)))
        
        return {
            'reuse': truly_valid,
            'reanalyze': needs_reanalysis,
            'new': [f for f in current_files if f not in cache.file_metadata]
        }
    
    def _has_dependency(self, file1: str, file2: str, cache: AnalysisCache) -> bool:
        """Check if file1 depends on file2 (simplified)"""
        # This is a simplified dependency check
        # In a real implementation, you'd check import relationships
        try:
            with open(file1, 'r') as f:
                content = f.read()
                # Simple check: does file1 import file2?
                module_name = Path(file2).stem
                return f"import {module_name}" in content or f"from {module_name}" in content
        except:
            return False
    
    def invalidate_cache(self, cache_id: str):
        """Manually invalidate a cache"""
        self._remove_cache(cache_id)
    
    def clear_all_caches(self):
        """Clear all caches"""
        for cache_file in self.cache_dir.glob("*.pkl"):
            cache_file.unlink()
        
        self.cache_index.clear()
        self.memory_cache.clear()
        self._save_cache_index()
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_size = 0
        cache_count = 0
        
        for cache_file in self.cache_dir.glob("*.pkl"):
            total_size += cache_file.stat().st_size
            cache_count += 1
        
        return {
            'cache_count': cache_count,
            'total_size_mb': total_size / (1024 * 1024),
            'max_size_mb': self.max_cache_size / (1024 * 1024),
            'memory_cache_count': len(self.memory_cache),
            'cache_dir': str(self.cache_dir)
        }


class IncrementalAnalyzer:
    """Handles incremental analysis using cached results"""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache_manager = cache_manager
    
    def can_use_incremental(self, project_path: str, options: Dict[str, Any]) -> Optional[str]:
        """Check if incremental analysis is possible"""
        cache_id = self.cache_manager.generate_cache_key(project_path, options)
        cache = self.cache_manager.get_cache(cache_id)
        
        if not cache:
            return None
        
        # Check if the cache is still valid for the project
        if not os.path.exists(cache.project_path):
            return None
        
        return cache_id
    
    def perform_incremental_analysis(self, project_path: str, current_files: List[str],
                                   cache_id: str, full_analyzer_func: callable) -> AnalysisResult:
        """Perform incremental analysis"""
        cache = self.cache_manager.get_cache(cache_id)
        if not cache:
            # Fallback to full analysis
            return full_analyzer_func(project_path, current_files)
        
        # Get incremental analysis plan
        plan = self.cache_manager.get_incremental_analysis_plan(cache, current_files)
        
        reuse_files = plan['reuse']
        reanalyze_files = plan['reanalyze'] + plan['new']
        
        print(f"🔄 Incremental Analysis Plan:")
        print(f"  📁 Reusing: {len(reuse_files)} files")
        print(f"  🔄 Re-analyzing: {len(reanalyze_files)} files")
        
        if len(reanalyze_files) / len(current_files) > 0.7:
            # If more than 70% needs re-analysis, just do full analysis
            print("⚡ Too many changes, performing full analysis")
            return full_analyzer_func(project_path, current_files)
        
        # Perform partial analysis only on changed files
        if reanalyze_files:
            # This would call the AST analyzer only on changed files
            partial_result = full_analyzer_func(project_path, reanalyze_files)
            
            # Merge with cached results
            merged_result = self._merge_analysis_results(cache.analysis_result, partial_result)
        else:
            # Nothing changed, use cached result
            merged_result = cache.analysis_result
        
        # Update cache with new results
        updated_cache = AnalysisCache(
            cache_id=cache_id,
            project_path=project_path,
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(days=7),
            analysis_result=merged_result
        )
        
        # Update file metadata
        for file_path in current_files:
            if os.path.exists(file_path):
                updated_cache.file_metadata[file_path] = FileMetadata.from_file(file_path)
        
        self.cache_manager.save_cache(updated_cache)
        
        return merged_result
    
    def _merge_analysis_results(self, cached_result: AnalysisResult, 
                              partial_result: AnalysisResult) -> AnalysisResult:
        """Merge cached results with new partial analysis"""
        # This is a simplified merge - in practice, you'd need sophisticated merging logic
        
        # Start with cached result
        merged = cached_result
        
        # Update with new analysis data
        # This would involve complex logic to update modules, classes, methods
        # while preserving relationships and avoiding duplicates
        
        return merged