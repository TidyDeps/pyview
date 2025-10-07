"""Complex class with high cyclomatic complexity and coupling"""

import json
import requests
import datetime
from typing import List, Dict, Any, Optional, Union
from abc import ABC, abstractmethod


class DataProcessor(ABC):
    """Abstract base class for data processing"""

    @abstractmethod
    def process(self, data: Any) -> Any:
        pass


class ComplexAnalyzer(DataProcessor):
    """Complex analyzer with many methods and high coupling"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.cache = {}
        self.results = []
        self.errors = []
        self.warnings = []
        self.status = "initialized"
        self.processed_count = 0
        self.failed_count = 0

    def validate_config(self) -> bool:
        """Validate configuration with multiple conditions"""
        if not self.config:
            self.errors.append("Config is empty")
            return False

        if "api_key" not in self.config:
            self.errors.append("Missing API key")
            return False

        if "endpoints" not in self.config:
            self.errors.append("Missing endpoints")
            return False

        if not isinstance(self.config["endpoints"], list):
            self.errors.append("Endpoints must be a list")
            return False

        for endpoint in self.config["endpoints"]:
            if not isinstance(endpoint, dict):
                self.errors.append("Each endpoint must be a dict")
                return False
            if "url" not in endpoint:
                self.errors.append("Each endpoint must have a URL")
                return False
            if "method" not in endpoint:
                self.warnings.append(f"Endpoint {endpoint['url']} missing method")

        return True

    def fetch_data(self, endpoint: str, method: str = "GET",
                   params: Optional[Dict] = None,
                   headers: Optional[Dict] = None) -> Union[Dict, List, None]:
        """Fetch data from API with complex error handling"""

        if endpoint in self.cache:
            return self.cache[endpoint]

        try:
            if method.upper() == "GET":
                response = requests.get(endpoint, params=params, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(endpoint, json=params, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(endpoint, json=params, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(endpoint, headers=headers, timeout=30)
            else:
                self.errors.append(f"Unsupported method: {method}")
                return None

            if response.status_code == 200:
                data = response.json()
                self.cache[endpoint] = data
                return data
            elif response.status_code == 404:
                self.warnings.append(f"Endpoint not found: {endpoint}")
                return None
            elif response.status_code == 401:
                self.errors.append(f"Unauthorized access: {endpoint}")
                return None
            elif response.status_code == 403:
                self.errors.append(f"Forbidden access: {endpoint}")
                return None
            elif response.status_code == 500:
                self.errors.append(f"Server error: {endpoint}")
                return None
            else:
                self.warnings.append(f"Unexpected status code {response.status_code}: {endpoint}")
                return None

        except requests.exceptions.ConnectionError:
            self.errors.append(f"Connection error: {endpoint}")
        except requests.exceptions.Timeout:
            self.errors.append(f"Timeout error: {endpoint}")
        except requests.exceptions.RequestException as e:
            self.errors.append(f"Request error: {endpoint} - {str(e)}")
        except json.JSONDecodeError:
            self.errors.append(f"JSON decode error: {endpoint}")
        except Exception as e:
            self.errors.append(f"Unexpected error: {endpoint} - {str(e)}")

        return None

    def process_item(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process individual item with complex logic"""

        if not item:
            return None

        processed_item = {}

        # Complex processing logic with many branches
        if "id" in item:
            processed_item["id"] = item["id"]
        else:
            processed_item["id"] = f"generated_{datetime.datetime.now().timestamp()}"

        if "name" in item:
            name = item["name"].strip()
            if len(name) > 50:
                name = name[:47] + "..."
                self.warnings.append(f"Name truncated for item {processed_item['id']}")
            processed_item["name"] = name
        else:
            processed_item["name"] = "Unknown"

        if "category" in item:
            category = item["category"].lower()
            if category in ["electronics", "books", "clothing", "home", "sports"]:
                processed_item["category"] = category
            else:
                processed_item["category"] = "other"
                self.warnings.append(f"Unknown category {item['category']} for item {processed_item['id']}")
        else:
            processed_item["category"] = "uncategorized"

        if "price" in item:
            try:
                price = float(item["price"])
                if price < 0:
                    self.warnings.append(f"Negative price for item {processed_item['id']}")
                    price = 0
                elif price > 10000:
                    self.warnings.append(f"Very high price for item {processed_item['id']}")
                processed_item["price"] = round(price, 2)
            except (ValueError, TypeError):
                self.errors.append(f"Invalid price for item {processed_item['id']}")
                processed_item["price"] = 0
        else:
            processed_item["price"] = 0

        if "tags" in item:
            if isinstance(item["tags"], list):
                tags = [tag.strip().lower() for tag in item["tags"] if isinstance(tag, str)]
                processed_item["tags"] = tags[:10]  # Limit to 10 tags
            else:
                processed_item["tags"] = []
        else:
            processed_item["tags"] = []

        if "metadata" in item and isinstance(item["metadata"], dict):
            processed_item["metadata"] = {}
            for key, value in item["metadata"].items():
                if isinstance(value, (str, int, float, bool)):
                    processed_item["metadata"][key] = value
                elif isinstance(value, list) and all(isinstance(v, (str, int, float)) for v in value):
                    processed_item["metadata"][key] = value

        processed_item["processed_at"] = datetime.datetime.now().isoformat()

        return processed_item

    def process(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Main processing method with complex flow control"""

        if not self.validate_config():
            self.status = "config_error"
            return []

        self.status = "processing"
        processed_items = []

        for i, item in enumerate(data):
            try:
                processed_item = self.process_item(item)
                if processed_item:
                    processed_items.append(processed_item)
                    self.processed_count += 1
                else:
                    self.failed_count += 1
                    self.warnings.append(f"Failed to process item at index {i}")

            except Exception as e:
                self.failed_count += 1
                self.errors.append(f"Error processing item at index {i}: {str(e)}")

            # Progress reporting every 100 items
            if (i + 1) % 100 == 0:
                print(f"Processed {i + 1} items")

        self.results = processed_items

        if self.errors:
            self.status = "completed_with_errors"
        elif self.warnings:
            self.status = "completed_with_warnings"
        else:
            self.status = "completed_successfully"

        return processed_items

    def generate_report(self) -> Dict[str, Any]:
        """Generate complex processing report"""

        report = {
            "status": self.status,
            "processed_count": self.processed_count,
            "failed_count": self.failed_count,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "success_rate": (self.processed_count / (self.processed_count + self.failed_count)) * 100 if (self.processed_count + self.failed_count) > 0 else 0,
            "timestamp": datetime.datetime.now().isoformat()
        }

        if self.errors:
            report["errors"] = self.errors[-10:]  # Last 10 errors

        if self.warnings:
            report["warnings"] = self.warnings[-10:]  # Last 10 warnings

        if self.results:
            categories = {}
            total_price = 0
            tags_frequency = {}

            for item in self.results:
                # Category statistics
                category = item.get("category", "unknown")
                categories[category] = categories.get(category, 0) + 1

                # Price statistics
                total_price += item.get("price", 0)

                # Tag frequency
                for tag in item.get("tags", []):
                    tags_frequency[tag] = tags_frequency.get(tag, 0) + 1

            report["statistics"] = {
                "categories": categories,
                "average_price": round(total_price / len(self.results), 2) if self.results else 0,
                "total_value": round(total_price, 2),
                "most_common_tags": sorted(tags_frequency.items(), key=lambda x: x[1], reverse=True)[:5]
            }

        return report