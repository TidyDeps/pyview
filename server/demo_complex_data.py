"""
Complex Demo Data for Testing Enhanced Visualization Features

Creates realistic complex dependency structures for testing:
- Large Django/Flask-like web application
- Microservices architecture
- Legacy monolith with circular dependencies
"""

def create_complex_web_app_demo():
    """Generate complex web application structure"""
    return {
        "summary": {
            "total_packages": 8,
            "total_modules": 45,
            "total_classes": 120,
            "total_methods": 380,
            "total_fields": 95,
        },
        "packages": [
            {"package_id": "pkg_core", "name": "core", "modules": ["models", "serializers", "views", "utils"]},
            {"package_id": "pkg_auth", "name": "authentication", "modules": ["models", "views", "middleware"]},
            {"package_id": "pkg_api", "name": "api", "modules": ["v1", "v2", "serializers", "permissions"]},
            {"package_id": "pkg_users", "name": "users", "modules": ["models", "views", "admin", "signals"]},
            {"package_id": "pkg_orders", "name": "orders", "modules": ["models", "views", "tasks", "utils"]},
            {"package_id": "pkg_payments", "name": "payments", "modules": ["models", "views", "gateways", "webhooks"]},
            {"package_id": "pkg_notifications", "name": "notifications", "modules": ["models", "tasks", "email", "sms"]},
            {"package_id": "pkg_analytics", "name": "analytics", "modules": ["models", "aggregators", "reports"]}
        ],
        "modules": [
            # Core package
            {"module_id": "mod_core_models", "name": "core.models", "package_id": "pkg_core", "file_path": "/app/core/models.py"},
            {"module_id": "mod_core_views", "name": "core.views", "package_id": "pkg_core", "file_path": "/app/core/views.py"},
            {"module_id": "mod_core_utils", "name": "core.utils", "package_id": "pkg_core", "file_path": "/app/core/utils.py"},
            
            # Auth package
            {"module_id": "mod_auth_models", "name": "auth.models", "package_id": "pkg_auth", "file_path": "/app/auth/models.py"},
            {"module_id": "mod_auth_views", "name": "auth.views", "package_id": "pkg_auth", "file_path": "/app/auth/views.py"},
            {"module_id": "mod_auth_middleware", "name": "auth.middleware", "package_id": "pkg_auth", "file_path": "/app/auth/middleware.py"},
            
            # Users package
            {"module_id": "mod_users_models", "name": "users.models", "package_id": "pkg_users", "file_path": "/app/users/models.py"},
            {"module_id": "mod_users_views", "name": "users.views", "package_id": "pkg_users", "file_path": "/app/users/views.py"},
            {"module_id": "mod_users_admin", "name": "users.admin", "package_id": "pkg_users", "file_path": "/app/users/admin.py"},
            
            # Orders package
            {"module_id": "mod_orders_models", "name": "orders.models", "package_id": "pkg_orders", "file_path": "/app/orders/models.py"},
            {"module_id": "mod_orders_views", "name": "orders.views", "package_id": "pkg_orders", "file_path": "/app/orders/views.py"},
            {"module_id": "mod_orders_tasks", "name": "orders.tasks", "package_id": "pkg_orders", "file_path": "/app/orders/tasks.py"},
            
            # Payments package
            {"module_id": "mod_payments_models", "name": "payments.models", "package_id": "pkg_payments", "file_path": "/app/payments/models.py"},
            {"module_id": "mod_payments_gateways", "name": "payments.gateways", "package_id": "pkg_payments", "file_path": "/app/payments/gateways.py"},
            {"module_id": "mod_payments_webhooks", "name": "payments.webhooks", "package_id": "pkg_payments", "file_path": "/app/payments/webhooks.py"},
            
            # API package
            {"module_id": "mod_api_v1", "name": "api.v1", "package_id": "pkg_api", "file_path": "/app/api/v1/__init__.py"},
            {"module_id": "mod_api_serializers", "name": "api.serializers", "package_id": "pkg_api", "file_path": "/app/api/serializers.py"},
            
            # Notifications package
            {"module_id": "mod_notif_models", "name": "notifications.models", "package_id": "pkg_notifications", "file_path": "/app/notifications/models.py"},
            {"module_id": "mod_notif_tasks", "name": "notifications.tasks", "package_id": "pkg_notifications", "file_path": "/app/notifications/tasks.py"},
            {"module_id": "mod_notif_email", "name": "notifications.email", "package_id": "pkg_notifications", "file_path": "/app/notifications/email.py"},
        ],
        "classes": [
            # Core models
            {"class_id": "cls_core_base", "name": "BaseModel", "module_id": "mod_core_models", "methods": ["save", "delete", "clean"]},
            {"class_id": "cls_core_manager", "name": "BaseManager", "module_id": "mod_core_models", "methods": ["get_queryset", "filter", "create"]},
            
            # Auth models
            {"class_id": "cls_auth_user", "name": "User", "module_id": "mod_auth_models", "methods": ["authenticate", "get_permissions", "is_active"]},
            {"class_id": "cls_auth_session", "name": "Session", "module_id": "mod_auth_models", "methods": ["create", "validate", "expire"]},
            
            # Users models
            {"class_id": "cls_users_profile", "name": "UserProfile", "module_id": "mod_users_models", "methods": ["get_full_name", "update_avatar", "get_preferences"]},
            {"class_id": "cls_users_viewset", "name": "UserViewSet", "module_id": "mod_users_views", "methods": ["list", "create", "update", "destroy"]},
            
            # Orders models
            {"class_id": "cls_orders_order", "name": "Order", "module_id": "mod_orders_models", "methods": ["calculate_total", "process", "cancel", "refund"]},
            {"class_id": "cls_orders_item", "name": "OrderItem", "module_id": "mod_orders_models", "methods": ["get_price", "apply_discount", "validate_stock"]},
            {"class_id": "cls_orders_processor", "name": "OrderProcessor", "module_id": "mod_orders_tasks", "methods": ["process_payment", "send_confirmation", "update_inventory"]},
            
            # Payments models
            {"class_id": "cls_payments_payment", "name": "Payment", "module_id": "mod_payments_models", "methods": ["charge", "refund", "validate", "get_status"]},
            {"class_id": "cls_payments_stripe", "name": "StripeGateway", "module_id": "mod_payments_gateways", "methods": ["charge", "create_customer", "handle_webhook"]},
            {"class_id": "cls_payments_paypal", "name": "PayPalGateway", "module_id": "mod_payments_gateways", "methods": ["charge", "validate_ipn", "process_refund"]},
            
            # API serializers
            {"class_id": "cls_api_user_serializer", "name": "UserSerializer", "module_id": "mod_api_serializers", "methods": ["validate", "create", "update"]},
            {"class_id": "cls_api_order_serializer", "name": "OrderSerializer", "module_id": "mod_api_serializers", "methods": ["validate", "create", "to_representation"]},
            
            # Notifications
            {"class_id": "cls_notif_email", "name": "EmailNotification", "module_id": "mod_notif_email", "methods": ["send", "render_template", "validate_recipients"]},
            {"class_id": "cls_notif_task", "name": "NotificationTask", "module_id": "mod_notif_tasks", "methods": ["send_order_confirmation", "send_payment_receipt", "send_reminder"]},
        ],
        "methods": [
            # User authentication methods
            {"method_id": "meth_user_auth", "name": "authenticate", "class_id": "cls_auth_user"},
            {"method_id": "meth_user_perms", "name": "get_permissions", "class_id": "cls_auth_user"},
            
            # Order processing methods
            {"method_id": "meth_order_calc", "name": "calculate_total", "class_id": "cls_orders_order"},
            {"method_id": "meth_order_process", "name": "process", "class_id": "cls_orders_order"},
            {"method_id": "meth_order_payment", "name": "process_payment", "class_id": "cls_orders_processor"},
            
            # Payment methods
            {"method_id": "meth_payment_charge", "name": "charge", "class_id": "cls_payments_payment"},
            {"method_id": "meth_stripe_charge", "name": "charge", "class_id": "cls_payments_stripe"},
            {"method_id": "meth_paypal_charge", "name": "charge", "class_id": "cls_payments_paypal"},
            
            # Notification methods
            {"method_id": "meth_email_send", "name": "send", "class_id": "cls_notif_email"},
            {"method_id": "meth_task_confirm", "name": "send_order_confirmation", "class_id": "cls_notif_task"},
        ],
        "relationships": [
            # Core dependencies
            {"from": "cls_auth_user", "to": "cls_core_base", "type": "inheritance"},
            {"from": "cls_users_profile", "to": "cls_auth_user", "type": "foreign_key"},
            {"from": "cls_orders_order", "to": "cls_auth_user", "type": "foreign_key"},
            
            # Order-Payment dependencies
            {"from": "cls_orders_processor", "to": "cls_payments_payment", "type": "call"},
            {"from": "cls_payments_payment", "to": "cls_payments_stripe", "type": "call"},
            {"from": "cls_payments_payment", "to": "cls_payments_paypal", "type": "call"},
            
            # Order-Notification dependencies  
            {"from": "cls_orders_processor", "to": "cls_notif_task", "type": "call"},
            {"from": "cls_notif_task", "to": "cls_notif_email", "type": "call"},
            
            # API dependencies
            {"from": "cls_api_user_serializer", "to": "cls_auth_user", "type": "reference"},
            {"from": "cls_api_order_serializer", "to": "cls_orders_order", "type": "reference"},
            {"from": "cls_users_viewset", "to": "cls_api_user_serializer", "type": "call"},
            
            # Cross-cutting concerns
            {"from": "cls_orders_order", "to": "cls_notif_task", "type": "call"},
            {"from": "cls_payments_stripe", "to": "cls_notif_task", "type": "call"},
            {"from": "cls_payments_paypal", "to": "cls_notif_task", "type": "call"},
            
            # Some circular dependencies (realistic in legacy systems)
            {"from": "cls_users_profile", "to": "cls_orders_order", "type": "reference"},
            {"from": "cls_orders_order", "to": "cls_users_profile", "type": "reference"},
            
            # More complex dependencies
            {"from": "cls_auth_middleware", "to": "cls_auth_user", "type": "call"},
            {"from": "cls_orders_views", "to": "cls_orders_order", "type": "call"},
            {"from": "cls_orders_views", "to": "cls_api_order_serializer", "type": "call"},
            {"from": "cls_payments_webhooks", "to": "cls_payments_payment", "type": "call"},
            {"from": "cls_payments_webhooks", "to": "cls_orders_processor", "type": "call"},
        ]
    }

def create_microservices_demo():
    """Generate microservices architecture data"""
    return {
        "summary": {
            "total_packages": 12,
            "total_modules": 60,
            "total_classes": 180,
            "total_methods": 520,
            "total_fields": 140,
        },
        "packages": [
            {"package_id": "svc_user", "name": "user-service", "modules": ["api", "models", "handlers"]},
            {"package_id": "svc_order", "name": "order-service", "modules": ["api", "models", "processors"]},
            {"package_id": "svc_payment", "name": "payment-service", "modules": ["api", "gateways", "models"]},
            {"package_id": "svc_notification", "name": "notification-service", "modules": ["api", "channels", "templates"]},
            {"package_id": "svc_inventory", "name": "inventory-service", "modules": ["api", "models", "sync"]},
            {"package_id": "svc_gateway", "name": "api-gateway", "modules": ["routing", "auth", "middleware"]},
            {"package_id": "shared_events", "name": "shared.events", "modules": ["publisher", "subscriber", "schemas"]},
            {"package_id": "shared_auth", "name": "shared.auth", "modules": ["jwt", "permissions", "decorators"]},
        ],
        # More complex inter-service dependencies...
        "relationships": [
            # Service-to-service communication
            {"from": "svc_order", "to": "svc_user", "type": "api_call"},
            {"from": "svc_order", "to": "svc_payment", "type": "api_call"},
            {"from": "svc_order", "to": "svc_inventory", "type": "api_call"},
            {"from": "svc_order", "to": "svc_notification", "type": "event"},
            {"from": "svc_payment", "to": "svc_notification", "type": "event"},
            {"from": "svc_inventory", "to": "shared_events", "type": "import"},
            {"from": "svc_gateway", "to": "shared_auth", "type": "import"},
            {"from": "svc_gateway", "to": "svc_user", "type": "proxy"},
            {"from": "svc_gateway", "to": "svc_order", "type": "proxy"},
            {"from": "svc_gateway", "to": "svc_payment", "type": "proxy"},
        ]
    }

def create_legacy_monolith_demo():
    """Generate legacy monolith with circular dependencies"""
    return {
        "summary": {
            "total_packages": 25,
            "total_modules": 150,
            "total_classes": 380,
            "total_methods": 1200,
            "total_fields": 280,
        },
        # Many circular dependencies, tightly coupled modules
        # Realistic representation of legacy enterprise systems
    }