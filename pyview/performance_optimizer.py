"""
PyView Performance Optimization

Implements performance optimizations for large codebases:
- Memory-efficient processing
- Streaming analysis
- Parallel processing
- Result pagination
- Progressive loading
"""

import os
import sys
import gc
import psutil
import time
import asyncio
from typing import List, Dict, Iterator, Optional, Callable, Any, Generator
from dataclasses import dataclass
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import threading
from queue import Queue
import json

from .models import AnalysisResult, ModuleInfo, ClassInfo, MethodInfo


@dataclass
class PerformanceConfig:
    """Performance optimization configuration"""
    max_memory_mb: int = 1024  # Maximum memory usage
    max_workers: int = None    # Number of worker processes
    batch_size: int = 100      # Files per batch
    enable_streaming: bool = True  # Stream results instead of loading all
    enable_gc: bool = True     # Aggressive garbage collection
    max_file_size_mb: int = 10  # Skip files larger than this
    enable_progress: bool = True  # Enable progress reporting


class MemoryMonitor:
    """Monitors memory usage during analysis"""
    
    def __init__(self, max_memory_mb: int):
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        self.process = psutil.Process()
        self.peak_memory = 0
        
    def get_memory_usage(self) -> int:
        """Get current memory usage in bytes"""
        memory_info = self.process.memory_info()
        current_memory = memory_info.rss
        self.peak_memory = max(self.peak_memory, current_memory)
        return current_memory
        
    def is_memory_critical(self) -> bool:
        """Check if memory usage is approaching limit"""
        current = self.get_memory_usage()
        return current > (self.max_memory_bytes * 0.8)  # 80% threshold
        
    def force_garbage_collection(self):
        """Force garbage collection to free memory"""
        gc.collect()
        
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory statistics"""
        current = self.get_memory_usage()
        return {
            'current_mb': current / (1024 * 1024),
            'peak_mb': self.peak_memory / (1024 * 1024),
            'limit_mb': self.max_memory_bytes / (1024 * 1024),
            'usage_percent': (current / self.max_memory_bytes) * 100
        }


class StreamingProcessor:
    """Processes files in streaming fashion to minimize memory usage"""
    
    def __init__(self, config: PerformanceConfig):
        self.config = config
        self.memory_monitor = MemoryMonitor(config.max_memory_mb)
        
    def process_files_streaming(self, file_paths: List[str], 
                               processor: Callable[[List[str]], List[Any]],
                               progress_callback: Optional[Callable] = None) -> Generator[Any, None, None]:
        """Process files in batches, yielding results as they're ready"""
        
        total_files = len(file_paths)
        processed = 0
        
        # Filter out large files to avoid memory issues
        filtered_paths = []
        for path in file_paths:
            try:
                file_size = os.path.getsize(path)
                if file_size <= self.config.max_file_size_mb * 1024 * 1024:
                    filtered_paths.append(path)
                else:
                    print(f"⚠️  Skipping large file: {path} ({file_size / (1024*1024):.1f} MB)")
            except OSError:
                continue
                
        print(f"📊 Processing {len(filtered_paths)}/{total_files} files (filtered out large files)")
        
        # Process in batches
        for i in range(0, len(filtered_paths), self.config.batch_size):
            batch = filtered_paths[i:i + self.config.batch_size]
            
            # Check memory before processing
            if self.memory_monitor.is_memory_critical():
                print("🧹 Memory usage high, forcing garbage collection...")
                self.memory_monitor.force_garbage_collection()
                time.sleep(0.1)  # Brief pause to let GC complete
                
            try:
                # Process batch
                batch_results = processor(batch)
                
                # Yield results one by one to keep memory usage low
                for result in batch_results:
                    yield result
                    
                processed += len(batch)
                
                if progress_callback and self.config.enable_progress:
                    progress = (processed / len(filtered_paths)) * 100
                    progress_callback(f"Processed {processed}/{len(filtered_paths)} files", progress)
                    
                # Force GC after each batch if enabled
                if self.config.enable_gc:
                    gc.collect()
                    
            except Exception as e:
                print(f"⚠️  Error processing batch {i//self.config.batch_size + 1}: {e}")
                continue


class ParallelAnalyzer:
    """Handles parallel processing with memory management"""
    
    def __init__(self, config: PerformanceConfig):
        self.config = config
        self.memory_monitor = MemoryMonitor(config.max_memory_mb)
        
        # Determine optimal worker count
        if config.max_workers is None:
            cpu_count = os.cpu_count() or 1
            # Use fewer workers for memory-constrained environments
            memory_gb = psutil.virtual_memory().total / (1024**3)
            if memory_gb < 8:
                self.max_workers = min(2, cpu_count)
            elif memory_gb < 16:
                self.max_workers = min(4, cpu_count)
            else:
                self.max_workers = min(8, cpu_count)
        else:
            self.max_workers = config.max_workers
            
        print(f"🚀 Using {self.max_workers} workers for parallel processing")
        
    def process_parallel(self, tasks: List[Any], 
                        worker_func: Callable,
                        progress_callback: Optional[Callable] = None) -> List[Any]:
        """Process tasks in parallel with memory management"""
        
        results = []
        completed = 0
        total_tasks = len(tasks)
        
        # Use ProcessPoolExecutor for CPU-bound tasks
        with ProcessPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit tasks in chunks to avoid overwhelming memory
            chunk_size = max(1, total_tasks // (self.max_workers * 2))
            
            future_to_task = {}
            pending_tasks = tasks.copy()
            
            # Initial batch submission
            initial_batch = pending_tasks[:chunk_size * self.max_workers]
            pending_tasks = pending_tasks[chunk_size * self.max_workers:]
            
            for task in initial_batch:
                future = executor.submit(worker_func, task)
                future_to_task[future] = task
                
            # Process completed tasks and submit new ones
            while future_to_task:
                # Check memory usage
                if self.memory_monitor.is_memory_critical():
                    print("🧹 Memory critical, pausing new task submission...")
                    self.memory_monitor.force_garbage_collection()
                    
                # Wait for at least one task to complete
                for future in as_completed(future_to_task, timeout=1):
                    try:
                        result = future.result()
                        results.append(result)
                        completed += 1
                        
                        if progress_callback and self.config.enable_progress:
                            progress = (completed / total_tasks) * 100
                            progress_callback(f"Completed {completed}/{total_tasks} tasks", progress)
                            
                    except Exception as e:
                        print(f"⚠️  Task failed: {e}")
                        
                    finally:
                        # Remove completed future
                        del future_to_task[future]
                        
                        # Submit new task if available and memory allows
                        if (pending_tasks and 
                            not self.memory_monitor.is_memory_critical() and
                            len(future_to_task) < self.max_workers * 2):
                            
                            new_task = pending_tasks.pop(0)
                            new_future = executor.submit(worker_func, new_task)
                            future_to_task[new_future] = new_task
                            
                    break  # Process one future at a time
                    
        return results


class LargeProjectAnalyzer:
    """Specialized analyzer for large projects (10,000+ modules)"""
    
    def __init__(self, config: PerformanceConfig = None):
        self.config = config or PerformanceConfig()
        self.streaming_processor = StreamingProcessor(self.config)
        self.parallel_analyzer = ParallelAnalyzer(self.config)
        self.memory_monitor = MemoryMonitor(self.config.max_memory_mb)
        
    def estimate_project_size(self, project_path: str) -> Dict[str, Any]:
        """Estimate project complexity and resource requirements"""
        python_files = []
        total_size = 0
        large_files = 0
        
        for root, dirs, files in os.walk(project_path):
            # Skip common non-essential directories
            dirs[:] = [d for d in dirs if d not in {
                '__pycache__', '.git', '.venv', 'venv', 'env', 'node_modules',
                '.pytest_cache', '.mypy_cache', 'build', 'dist', '.tox'
            }]
            
            for file in files:
                if file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    try:
                        size = os.path.getsize(file_path)
                        python_files.append((file_path, size))
                        total_size += size
                        
                        if size > self.config.max_file_size_mb * 1024 * 1024:
                            large_files += 1
                            
                    except OSError:
                        continue
        
        # Estimate analysis complexity
        complexity = "low"
        if len(python_files) > 1000:
            complexity = "medium"
        if len(python_files) > 5000:
            complexity = "high"
        if len(python_files) > 10000:
            complexity = "very_high"
            
        # Estimate memory requirements
        estimated_memory_mb = (total_size / (1024 * 1024)) * 2  # Rough estimate
        
        return {
            'total_files': len(python_files),
            'total_size_mb': total_size / (1024 * 1024),
            'large_files': large_files,
            'complexity': complexity,
            'estimated_memory_mb': estimated_memory_mb,
            'recommended_workers': self.parallel_analyzer.max_workers,
            'recommended_batch_size': min(self.config.batch_size, max(10, len(python_files) // 100))
        }
        
    def analyze_large_project(self, project_path: str, 
                             analyzer_func: Callable,
                             progress_callback: Optional[Callable] = None) -> Iterator[Any]:
        """Analyze large project with optimizations"""
        
        # First, estimate project size
        project_stats = self.estimate_project_size(project_path)
        
        print(f"📊 Project Analysis:")
        print(f"  📁 Files: {project_stats['total_files']:,}")
        print(f"  💾 Size: {project_stats['total_size_mb']:.1f} MB")
        print(f"  🧠 Complexity: {project_stats['complexity']}")
        print(f"  🚀 Workers: {project_stats['recommended_workers']}")
        
        if project_stats['complexity'] in ['high', 'very_high']:
            print("⚠️  Large project detected, using streaming analysis...")
            
        # Get file list
        python_files = []
        for root, dirs, files in os.walk(project_path):
            dirs[:] = [d for d in dirs if d not in {
                '__pycache__', '.git', '.venv', 'venv', 'env'
            }]
            
            for file in files:
                if file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    python_files.append(file_path)
        
        # Use streaming processor for large projects
        if len(python_files) > 1000:
            print("🌊 Using streaming analysis for memory efficiency...")
            
            def batch_analyzer(file_batch):
                return analyzer_func(file_batch)
                
            yield from self.streaming_processor.process_files_streaming(
                python_files, batch_analyzer, progress_callback
            )
        else:
            # Regular parallel processing for smaller projects
            print("⚡ Using standard parallel analysis...")
            
            def file_analyzer(file_path):
                return analyzer_func([file_path])[0]  # Assume single result
                
            results = self.parallel_analyzer.process_parallel(
                python_files, file_analyzer, progress_callback
            )
            
            for result in results:
                yield result
                
        # Print final memory statistics
        memory_stats = self.memory_monitor.get_memory_stats()
        print(f"📊 Memory Usage:")
        print(f"  Current: {memory_stats['current_mb']:.1f} MB")
        print(f"  Peak: {memory_stats['peak_mb']:.1f} MB")
        print(f"  Usage: {memory_stats['usage_percent']:.1f}%")


class ResultPaginator:
    """Handles pagination of large result sets"""
    
    def __init__(self, page_size: int = 100):
        self.page_size = page_size
        
    def paginate_results(self, results: List[Any], page: int = 1) -> Dict[str, Any]:
        """Paginate results for memory-efficient display"""
        total_results = len(results)
        total_pages = (total_results + self.page_size - 1) // self.page_size
        
        start_idx = (page - 1) * self.page_size
        end_idx = min(start_idx + self.page_size, total_results)
        
        page_results = results[start_idx:end_idx]
        
        return {
            'results': page_results,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_results': total_results,
                'page_size': self.page_size,
                'has_next': page < total_pages,
                'has_previous': page > 1
            }
        }
        
    def create_result_summary(self, results: List[Any]) -> Dict[str, Any]:
        """Create summary statistics without loading all results"""
        
        # Sample results for statistics (don't load everything)
        sample_size = min(1000, len(results))
        sample = results[:sample_size] if len(results) > sample_size else results
        
        # Basic statistics
        entity_types = {}
        complexity_stats = []
        
        for result in sample:
            entity_type = getattr(result, 'type', 'unknown')
            entity_types[entity_type] = entity_types.get(entity_type, 0) + 1
            
            complexity = getattr(result, 'complexity', 0)
            if complexity:
                complexity_stats.append(complexity)
                
        avg_complexity = sum(complexity_stats) / len(complexity_stats) if complexity_stats else 0
        
        return {
            'total_results': len(results),
            'sample_size': sample_size,
            'entity_types': entity_types,
            'avg_complexity': avg_complexity,
            'is_sampled': len(results) > sample_size
        }