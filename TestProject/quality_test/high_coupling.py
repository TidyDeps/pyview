"""Module with high coupling between classes for testing quality metrics"""

from typing import List, Dict, Any, Optional
from .complex_class import ComplexAnalyzer
from .duplicate_code import UserManager, ConfigManager
from .long_function import massive_data_transformer
import datetime
import json


class DatabaseConnection:
    """Database connection class that's tightly coupled to many other classes"""

    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.connection = None
        self.is_connected = False
        self.query_log = []
        self.transaction_manager = None
        self.cache_manager = None

    def connect(self) -> bool:
        config = self.config_manager.config
        # Simulated database connection
        self.is_connected = True
        return True

    def execute_query(self, query: str) -> List[Dict[str, Any]]:
        self.query_log.append({
            "query": query,
            "timestamp": datetime.datetime.now().isoformat()
        })
        # Simulated query execution
        return [{"result": "simulated"}]


class TransactionManager:
    """Transaction manager tightly coupled to database and other services"""

    def __init__(self, db_connection: DatabaseConnection,
                 user_manager: UserManager,
                 audit_service: 'AuditService'):
        self.db_connection = db_connection
        self.user_manager = user_manager
        self.audit_service = audit_service
        self.active_transactions = []
        self.completed_transactions = []

    def begin_transaction(self, user_id: int) -> str:
        user = next((u for u in self.user_manager.users if u["id"] == user_id), None)
        if not user:
            raise ValueError("User not found")

        transaction_id = f"tx_{len(self.active_transactions) + 1}"
        transaction = {
            "id": transaction_id,
            "user_id": user_id,
            "started_at": datetime.datetime.now().isoformat(),
            "operations": []
        }
        self.active_transactions.append(transaction)
        self.audit_service.log_transaction_start(transaction_id, user_id)
        return transaction_id

    def commit_transaction(self, transaction_id: str) -> bool:
        transaction = next((t for t in self.active_transactions if t["id"] == transaction_id), None)
        if not transaction:
            return False

        transaction["completed_at"] = datetime.datetime.now().isoformat()
        self.completed_transactions.append(transaction)
        self.active_transactions.remove(transaction)
        self.audit_service.log_transaction_commit(transaction_id)
        return True


class CacheManager:
    """Cache manager that depends on multiple other services"""

    def __init__(self, db_connection: DatabaseConnection,
                 config_manager: ConfigManager,
                 analytics_service: 'AnalyticsService'):
        self.db_connection = db_connection
        self.config_manager = config_manager
        self.analytics_service = analytics_service
        self.cache = {}
        self.hit_count = 0
        self.miss_count = 0

    def get(self, key: str) -> Any:
        if key in self.cache:
            self.hit_count += 1
            self.analytics_service.record_cache_hit(key)
            return self.cache[key]
        else:
            self.miss_count += 1
            self.analytics_service.record_cache_miss(key)
            # Fetch from database
            data = self.db_connection.execute_query(f"SELECT * FROM cache WHERE key='{key}'")
            if data:
                self.cache[key] = data[0]
                return data[0]
            return None

    def set(self, key: str, value: Any) -> None:
        self.cache[key] = value
        self.analytics_service.record_cache_set(key)


class AuditService:
    """Audit service that tracks all system activities"""

    def __init__(self, db_connection: DatabaseConnection,
                 user_manager: UserManager,
                 notification_service: 'NotificationService'):
        self.db_connection = db_connection
        self.user_manager = user_manager
        self.notification_service = notification_service
        self.audit_log = []

    def log_transaction_start(self, transaction_id: str, user_id: int) -> None:
        user = next((u for u in self.user_manager.users if u["id"] == user_id), None)
        log_entry = {
            "event": "transaction_start",
            "transaction_id": transaction_id,
            "user_id": user_id,
            "username": user["username"] if user else "unknown",
            "timestamp": datetime.datetime.now().isoformat()
        }
        self.audit_log.append(log_entry)
        self.notification_service.send_audit_notification(log_entry)

    def log_transaction_commit(self, transaction_id: str) -> None:
        log_entry = {
            "event": "transaction_commit",
            "transaction_id": transaction_id,
            "timestamp": datetime.datetime.now().isoformat()
        }
        self.audit_log.append(log_entry)


class NotificationService:
    """Notification service that sends alerts to users"""

    def __init__(self, user_manager: UserManager,
                 config_manager: ConfigManager,
                 template_service: 'TemplateService'):
        self.user_manager = user_manager
        self.config_manager = config_manager
        self.template_service = template_service
        self.sent_notifications = []

    def send_audit_notification(self, audit_entry: Dict[str, Any]) -> None:
        # Get admin users
        admin_users = [u for u in self.user_manager.users if u.get("is_admin", False)]

        for admin in admin_users:
            template = self.template_service.get_template("audit_notification")
            message = template.format(**audit_entry)
            notification = {
                "to": admin["email"],
                "subject": "Audit Alert",
                "message": message,
                "sent_at": datetime.datetime.now().isoformat()
            }
            self.sent_notifications.append(notification)

    def send_user_notification(self, user_id: int, message: str) -> None:
        user = next((u for u in self.user_manager.users if u["id"] == user_id), None)
        if user:
            notification = {
                "to": user["email"],
                "subject": "User Notification",
                "message": message,
                "sent_at": datetime.datetime.now().isoformat()
            }
            self.sent_notifications.append(notification)


class TemplateService:
    """Template service for formatting messages"""

    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.templates = {
            "audit_notification": "Audit Event: {event} for transaction {transaction_id} at {timestamp}",
            "user_welcome": "Welcome {username}! Your account has been created.",
            "password_reset": "Your password has been reset. Please check your email."
        }

    def get_template(self, template_name: str) -> str:
        return self.templates.get(template_name, "Template not found")


class AnalyticsService:
    """Analytics service that tracks system metrics"""

    def __init__(self, db_connection: DatabaseConnection,
                 cache_manager: CacheManager,
                 config_manager: ConfigManager):
        self.db_connection = db_connection
        self.cache_manager = cache_manager
        self.config_manager = config_manager
        self.metrics = {
            "cache_hits": 0,
            "cache_misses": 0,
            "cache_sets": 0,
            "queries_executed": 0
        }

    def record_cache_hit(self, key: str) -> None:
        self.metrics["cache_hits"] += 1
        self.db_connection.execute_query(f"INSERT INTO cache_metrics (event, key) VALUES ('hit', '{key}')")

    def record_cache_miss(self, key: str) -> None:
        self.metrics["cache_misses"] += 1
        self.db_connection.execute_query(f"INSERT INTO cache_metrics (event, key) VALUES ('miss', '{key}')")

    def record_cache_set(self, key: str) -> None:
        self.metrics["cache_sets"] += 1

    def generate_report(self) -> Dict[str, Any]:
        return {
            "metrics": self.metrics,
            "cache_hit_rate": self.metrics["cache_hits"] / (self.metrics["cache_hits"] + self.metrics["cache_misses"]) if (self.metrics["cache_hits"] + self.metrics["cache_misses"]) > 0 else 0,
            "total_operations": sum(self.metrics.values()),
            "generated_at": datetime.datetime.now().isoformat()
        }


class ApplicationService:
    """Main application service that orchestrates all other services"""

    def __init__(self):
        # Initialize all services with tight coupling
        self.config_manager = ConfigManager()
        self.user_manager = UserManager()
        self.db_connection = DatabaseConnection(self.config_manager)

        # Forward declare services that depend on each other
        self.template_service = TemplateService(self.config_manager)
        self.notification_service = NotificationService(
            self.user_manager,
            self.config_manager,
            self.template_service
        )
        self.audit_service = AuditService(
            self.db_connection,
            self.user_manager,
            self.notification_service
        )
        self.cache_manager = CacheManager(
            self.db_connection,
            self.config_manager,
            None  # Will be set later due to circular dependency
        )
        self.analytics_service = AnalyticsService(
            self.db_connection,
            self.cache_manager,
            self.config_manager
        )
        self.transaction_manager = TransactionManager(
            self.db_connection,
            self.user_manager,
            self.audit_service
        )

        # Fix circular dependency
        self.cache_manager.analytics_service = self.analytics_service

        # Initialize complex analyzer
        self.data_analyzer = ComplexAnalyzer({
            "api_key": "test_key",
            "endpoints": [{"url": "http://example.com", "method": "GET"}]
        })

    def initialize_system(self) -> bool:
        """Initialize the entire system with all dependencies"""
        try:
            # Load configuration
            self.config_manager.load_app_config("config.json")

            # Connect to database
            self.db_connection.connect()

            # Initialize cache
            self.cache_manager.set("system_initialized", True)

            return True
        except Exception as e:
            print(f"System initialization failed: {str(e)}")
            return False

    def process_user_data(self, user_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process user data using multiple tightly coupled services"""
        # Start transaction
        admin_user = next((u for u in self.user_manager.users if u.get("is_admin")), None)
        if not admin_user:
            # Create default admin
            admin_user = self.user_manager.create_admin_profile({
                "username": "admin",
                "email": "admin@example.com",
                "password": "admin123456"
            })

        transaction_id = self.transaction_manager.begin_transaction(admin_user["id"])

        try:
            # Transform data using the massive function
            transformed_data, report = massive_data_transformer(
                user_data,
                {
                    "field_mappings": {"name": "username", "mail": "email"},
                    "data_types": {"username": "string", "email": "string"},
                    "validation_rules": {"username": {"required": True, "min_length": 3}},
                    "default_values": {"username": "anonymous"}
                },
                {"strict_validation": False, "allow_missing_fields": True}
            )

            # Analyze with complex analyzer
            analysis_results = self.data_analyzer.process(transformed_data)

            # Generate analytics report
            analytics_report = self.analytics_service.generate_report()

            # Commit transaction
            self.transaction_manager.commit_transaction(transaction_id)

            return {
                "transformed_data": transformed_data,
                "transformation_report": report,
                "analysis_results": analysis_results,
                "analytics_report": analytics_report,
                "transaction_id": transaction_id
            }

        except Exception as e:
            # Transaction will remain active (not committed)
            self.audit_service.log_transaction_start(f"error_{transaction_id}", admin_user["id"])
            raise e