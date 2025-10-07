"""Module with intentional code duplication for testing quality metrics"""

import os
import sys
import json
from typing import List, Dict, Any


class UserManager:
    """Class with duplicate methods to test code duplication detection"""

    def __init__(self):
        self.users = []
        self.active_users = []

    def create_user_profile(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new user profile with validation"""
        if not user_data.get("username"):
            raise ValueError("Username is required")

        if not user_data.get("email"):
            raise ValueError("Email is required")

        if "@" not in user_data.get("email", ""):
            raise ValueError("Invalid email format")

        if len(user_data.get("username", "")) < 3:
            raise ValueError("Username must be at least 3 characters")

        if len(user_data.get("password", "")) < 8:
            raise ValueError("Password must be at least 8 characters")

        new_user = {
            "id": len(self.users) + 1,
            "username": user_data["username"],
            "email": user_data["email"],
            "password": user_data["password"],
            "created_at": "2024-01-01",
            "last_login": None,
            "is_active": True,
            "profile_complete": False
        }

        self.users.append(new_user)
        return new_user

    def create_admin_profile(self, admin_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new admin profile with validation (duplicate logic)"""
        if not admin_data.get("username"):
            raise ValueError("Username is required")

        if not admin_data.get("email"):
            raise ValueError("Email is required")

        if "@" not in admin_data.get("email", ""):
            raise ValueError("Invalid email format")

        if len(admin_data.get("username", "")) < 3:
            raise ValueError("Username must be at least 3 characters")

        if len(admin_data.get("password", "")) < 8:
            raise ValueError("Password must be at least 8 characters")

        new_admin = {
            "id": len(self.users) + 1,
            "username": admin_data["username"],
            "email": admin_data["email"],
            "password": admin_data["password"],
            "created_at": "2024-01-01",
            "last_login": None,
            "is_active": True,
            "profile_complete": False,
            "is_admin": True,
            "permissions": ["read", "write", "delete", "admin"]
        }

        self.users.append(new_admin)
        return new_admin

    def update_user_info(self, user_id: int, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user information with validation"""
        user = None
        for u in self.users:
            if u["id"] == user_id:
                user = u
                break

        if not user:
            raise ValueError("User not found")

        if "username" in update_data:
            if not update_data["username"]:
                raise ValueError("Username cannot be empty")
            if len(update_data["username"]) < 3:
                raise ValueError("Username must be at least 3 characters")
            user["username"] = update_data["username"]

        if "email" in update_data:
            if not update_data["email"]:
                raise ValueError("Email cannot be empty")
            if "@" not in update_data["email"]:
                raise ValueError("Invalid email format")
            user["email"] = update_data["email"]

        if "password" in update_data:
            if len(update_data["password"]) < 8:
                raise ValueError("Password must be at least 8 characters")
            user["password"] = update_data["password"]

        user["profile_complete"] = True
        return user

    def update_admin_info(self, admin_id: int, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update admin information with validation (duplicate logic)"""
        admin = None
        for u in self.users:
            if u["id"] == admin_id:
                admin = u
                break

        if not admin:
            raise ValueError("Admin not found")

        if "username" in update_data:
            if not update_data["username"]:
                raise ValueError("Username cannot be empty")
            if len(update_data["username"]) < 3:
                raise ValueError("Username must be at least 3 characters")
            admin["username"] = update_data["username"]

        if "email" in update_data:
            if not update_data["email"]:
                raise ValueError("Email cannot be empty")
            if "@" not in update_data["email"]:
                raise ValueError("Invalid email format")
            admin["email"] = update_data["email"]

        if "password" in update_data:
            if len(update_data["password"]) < 8:
                raise ValueError("Password must be at least 8 characters")
            admin["password"] = update_data["password"]

        if "permissions" in update_data:
            admin["permissions"] = update_data["permissions"]

        admin["profile_complete"] = True
        return admin


class ConfigManager:
    """Class with duplicate configuration handling logic"""

    def __init__(self):
        self.config = {}
        self.settings = {}

    def load_app_config(self, config_file: str) -> Dict[str, Any]:
        """Load application configuration from file"""
        if not os.path.exists(config_file):
            raise FileNotFoundError(f"Config file not found: {config_file}")

        try:
            with open(config_file, 'r') as f:
                config_data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in config file: {str(e)}")

        # Validate required keys
        required_keys = ["database", "api_keys", "logging", "cache"]
        missing_keys = [key for key in required_keys if key not in config_data]
        if missing_keys:
            raise ValueError(f"Missing required config keys: {missing_keys}")

        # Set defaults for optional keys
        if "timeout" not in config_data:
            config_data["timeout"] = 30

        if "max_connections" not in config_data:
            config_data["max_connections"] = 100

        if "debug" not in config_data:
            config_data["debug"] = False

        self.config = config_data
        return config_data

    def load_user_settings(self, settings_file: str) -> Dict[str, Any]:
        """Load user settings from file (duplicate logic)"""
        if not os.path.exists(settings_file):
            raise FileNotFoundError(f"Settings file not found: {settings_file}")

        try:
            with open(settings_file, 'r') as f:
                settings_data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in settings file: {str(e)}")

        # Validate required keys
        required_keys = ["theme", "language", "notifications", "privacy"]
        missing_keys = [key for key in required_keys if key not in settings_data]
        if missing_keys:
            raise ValueError(f"Missing required settings keys: {missing_keys}")

        # Set defaults for optional keys
        if "auto_save" not in settings_data:
            settings_data["auto_save"] = True

        if "backup_frequency" not in settings_data:
            settings_data["backup_frequency"] = "daily"

        if "sync_enabled" not in settings_data:
            settings_data["sync_enabled"] = False

        self.settings = settings_data
        return settings_data

    def save_app_config(self, config_file: str, config_data: Dict[str, Any]) -> bool:
        """Save application configuration to file"""
        # Validate config data
        required_keys = ["database", "api_keys", "logging", "cache"]
        missing_keys = [key for key in required_keys if key not in config_data]
        if missing_keys:
            raise ValueError(f"Missing required config keys: {missing_keys}")

        # Create backup of existing config
        if os.path.exists(config_file):
            backup_file = f"{config_file}.backup"
            try:
                with open(config_file, 'r') as source:
                    with open(backup_file, 'w') as backup:
                        backup.write(source.read())
            except Exception as e:
                print(f"Warning: Could not create backup: {str(e)}")

        # Write new config
        try:
            with open(config_file, 'w') as f:
                json.dump(config_data, f, indent=2)
            self.config = config_data
            return True
        except Exception as e:
            print(f"Error saving config: {str(e)}")
            return False

    def save_user_settings(self, settings_file: str, settings_data: Dict[str, Any]) -> bool:
        """Save user settings to file (duplicate logic)"""
        # Validate settings data
        required_keys = ["theme", "language", "notifications", "privacy"]
        missing_keys = [key for key in required_keys if key not in settings_data]
        if missing_keys:
            raise ValueError(f"Missing required settings keys: {missing_keys}")

        # Create backup of existing settings
        if os.path.exists(settings_file):
            backup_file = f"{settings_file}.backup"
            try:
                with open(settings_file, 'r') as source:
                    with open(backup_file, 'w') as backup:
                        backup.write(source.read())
            except Exception as e:
                print(f"Warning: Could not create backup: {str(e)}")

        # Write new settings
        try:
            with open(settings_file, 'w') as f:
                json.dump(settings_data, f, indent=2)
            self.settings = settings_data
            return True
        except Exception as e:
            print(f"Error saving settings: {str(e)}")
            return False


def validate_email_format(email: str) -> bool:
    """Validate email format (duplicate utility function)"""
    if not email:
        return False
    if "@" not in email:
        return False
    if "." not in email.split("@")[1]:
        return False
    return True


def check_email_validity(email_address: str) -> bool:
    """Check if email is valid (duplicate logic)"""
    if not email_address:
        return False
    if "@" not in email_address:
        return False
    if "." not in email_address.split("@")[1]:
        return False
    return True


def is_valid_email(email_str: str) -> bool:
    """Another email validation function (more duplication)"""
    if not email_str:
        return False
    if "@" not in email_str:
        return False
    parts = email_str.split("@")
    if len(parts) != 2:
        return False
    if "." not in parts[1]:
        return False
    return True


def process_user_list(users: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Process a list of users (duplicate processing logic)"""
    processed_users = []

    for user in users:
        processed_user = {}

        # Copy basic fields
        if "id" in user:
            processed_user["id"] = user["id"]
        if "username" in user:
            processed_user["username"] = user["username"].strip()
        if "email" in user:
            processed_user["email"] = user["email"].lower().strip()

        # Add computed fields
        processed_user["display_name"] = processed_user.get("username", "Unknown")
        processed_user["email_valid"] = validate_email_format(processed_user.get("email", ""))

        processed_users.append(processed_user)

    return processed_users


def handle_admin_list(admins: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Process a list of admins (duplicate processing logic)"""
    processed_admins = []

    for admin in admins:
        processed_admin = {}

        # Copy basic fields
        if "id" in admin:
            processed_admin["id"] = admin["id"]
        if "username" in admin:
            processed_admin["username"] = admin["username"].strip()
        if "email" in admin:
            processed_admin["email"] = admin["email"].lower().strip()

        # Add computed fields
        processed_admin["display_name"] = processed_admin.get("username", "Unknown")
        processed_admin["email_valid"] = check_email_validity(processed_admin.get("email", ""))
        processed_admin["is_admin"] = True

        processed_admins.append(processed_admin)

    return processed_admins