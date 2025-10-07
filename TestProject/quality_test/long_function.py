"""Module with very long functions for testing quality metrics"""

import re
import math
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple


def massive_data_transformer(data: List[Dict[str, Any]],
                           transformation_rules: Dict[str, Any],
                           validation_settings: Dict[str, Any],
                           output_format: str = "json",
                           enable_logging: bool = True,
                           batch_size: int = 1000) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Extremely long function that transforms data according to complex rules.
    This function intentionally violates many quality metrics for testing purposes.
    """

    # Initialize tracking variables
    processed_count = 0
    error_count = 0
    warning_count = 0
    transformation_stats = {}
    validation_errors = []
    processing_log = []

    if enable_logging:
        processing_log.append(f"Started processing at {datetime.now()}")
        processing_log.append(f"Input data size: {len(data)}")
        processing_log.append(f"Batch size: {batch_size}")

    # Validate transformation rules
    required_rules = ["field_mappings", "data_types", "validation_rules", "default_values"]
    for rule in required_rules:
        if rule not in transformation_rules:
            error_msg = f"Missing required transformation rule: {rule}"
            validation_errors.append(error_msg)
            if enable_logging:
                processing_log.append(f"ERROR: {error_msg}")

    if validation_errors:
        return [], {"errors": validation_errors, "processed_count": 0}

    # Extract transformation rules
    field_mappings = transformation_rules["field_mappings"]
    data_types = transformation_rules["data_types"]
    validation_rules = transformation_rules["validation_rules"]
    default_values = transformation_rules["default_values"]

    # Extract validation settings
    strict_validation = validation_settings.get("strict_validation", True)
    allow_missing_fields = validation_settings.get("allow_missing_fields", False)
    max_errors = validation_settings.get("max_errors", 100)
    skip_invalid_records = validation_settings.get("skip_invalid_records", False)

    transformed_data = []
    batch_data = []

    for i, record in enumerate(data):
        if enable_logging and i % 1000 == 0:
            processing_log.append(f"Processing record {i+1}/{len(data)}")

        transformed_record = {}
        record_errors = []
        record_warnings = []

        # Apply field mappings
        for old_field, new_field in field_mappings.items():
            if old_field in record:
                value = record[old_field]

                # Check if new field already exists
                if new_field in transformed_record:
                    record_warnings.append(f"Field mapping conflict: {new_field} already exists")
                    if enable_logging:
                        processing_log.append(f"WARNING: Field mapping conflict for record {i}")

                # Apply data type conversion
                if new_field in data_types:
                    target_type = data_types[new_field]

                    try:
                        if target_type == "string":
                            transformed_record[new_field] = str(value)
                        elif target_type == "integer":
                            if isinstance(value, str):
                                # Handle string to int conversion
                                if value.strip() == "":
                                    transformed_record[new_field] = default_values.get(new_field, 0)
                                else:
                                    # Try to extract numbers from string
                                    numbers = re.findall(r'-?\d+', value)
                                    if numbers:
                                        transformed_record[new_field] = int(numbers[0])
                                    else:
                                        transformed_record[new_field] = default_values.get(new_field, 0)
                                        record_warnings.append(f"Could not convert {old_field} to integer")
                            else:
                                transformed_record[new_field] = int(value)
                        elif target_type == "float":
                            if isinstance(value, str):
                                if value.strip() == "":
                                    transformed_record[new_field] = default_values.get(new_field, 0.0)
                                else:
                                    # Try to extract numbers from string
                                    numbers = re.findall(r'-?\d+\.?\d*', value)
                                    if numbers:
                                        transformed_record[new_field] = float(numbers[0])
                                    else:
                                        transformed_record[new_field] = default_values.get(new_field, 0.0)
                                        record_warnings.append(f"Could not convert {old_field} to float")
                            else:
                                transformed_record[new_field] = float(value)
                        elif target_type == "boolean":
                            if isinstance(value, str):
                                lower_value = value.lower().strip()
                                if lower_value in ["true", "1", "yes", "y", "on"]:
                                    transformed_record[new_field] = True
                                elif lower_value in ["false", "0", "no", "n", "off"]:
                                    transformed_record[new_field] = False
                                else:
                                    transformed_record[new_field] = default_values.get(new_field, False)
                                    record_warnings.append(f"Could not convert {old_field} to boolean")
                            else:
                                transformed_record[new_field] = bool(value)
                        elif target_type == "date":
                            if isinstance(value, str):
                                # Try multiple date formats
                                date_formats = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"]
                                parsed_date = None
                                for fmt in date_formats:
                                    try:
                                        parsed_date = datetime.strptime(value, fmt)
                                        break
                                    except ValueError:
                                        continue

                                if parsed_date:
                                    transformed_record[new_field] = parsed_date.isoformat()
                                else:
                                    transformed_record[new_field] = default_values.get(new_field, datetime.now().isoformat())
                                    record_warnings.append(f"Could not parse date from {old_field}")
                            else:
                                transformed_record[new_field] = str(value)
                        elif target_type == "list":
                            if isinstance(value, str):
                                # Try to parse as comma-separated values
                                if "," in value:
                                    transformed_record[new_field] = [item.strip() for item in value.split(",")]
                                else:
                                    transformed_record[new_field] = [value]
                            elif isinstance(value, list):
                                transformed_record[new_field] = value
                            else:
                                transformed_record[new_field] = [str(value)]
                        else:
                            transformed_record[new_field] = value
                            record_warnings.append(f"Unknown data type: {target_type}")

                    except (ValueError, TypeError) as e:
                        record_errors.append(f"Type conversion error for {old_field}: {str(e)}")
                        transformed_record[new_field] = default_values.get(new_field, None)
                        if enable_logging:
                            processing_log.append(f"ERROR: Type conversion failed for record {i}, field {old_field}")

                else:
                    # No type conversion specified, use original value
                    transformed_record[new_field] = value

            else:
                # Field not found in original record
                if not allow_missing_fields:
                    record_errors.append(f"Missing required field: {old_field}")
                else:
                    if new_field in default_values:
                        transformed_record[new_field] = default_values[new_field]
                        record_warnings.append(f"Using default value for missing field: {old_field}")

        # Apply validation rules
        for field, rules in validation_rules.items():
            if field in transformed_record:
                value = transformed_record[field]

                if "required" in rules and rules["required"]:
                    if value is None or (isinstance(value, str) and value.strip() == ""):
                        record_errors.append(f"Required field {field} is empty")

                if "min_length" in rules:
                    if isinstance(value, str) and len(value) < rules["min_length"]:
                        record_errors.append(f"Field {field} is too short (min: {rules['min_length']})")

                if "max_length" in rules:
                    if isinstance(value, str) and len(value) > rules["max_length"]:
                        if strict_validation:
                            record_errors.append(f"Field {field} is too long (max: {rules['max_length']})")
                        else:
                            transformed_record[field] = value[:rules["max_length"]]
                            record_warnings.append(f"Field {field} was truncated")

                if "min_value" in rules:
                    if isinstance(value, (int, float)) and value < rules["min_value"]:
                        record_errors.append(f"Field {field} is below minimum value ({rules['min_value']})")

                if "max_value" in rules:
                    if isinstance(value, (int, float)) and value > rules["max_value"]:
                        if strict_validation:
                            record_errors.append(f"Field {field} exceeds maximum value ({rules['max_value']})")
                        else:
                            transformed_record[field] = rules["max_value"]
                            record_warnings.append(f"Field {field} was capped at maximum value")

                if "pattern" in rules:
                    if isinstance(value, str) and not re.match(rules["pattern"], value):
                        record_errors.append(f"Field {field} does not match required pattern")

                if "allowed_values" in rules:
                    if value not in rules["allowed_values"]:
                        if strict_validation:
                            record_errors.append(f"Field {field} has invalid value: {value}")
                        else:
                            # Try to find closest match
                            closest_match = min(rules["allowed_values"],
                                              key=lambda x: abs(hash(str(x)) - hash(str(value))))
                            transformed_record[field] = closest_match
                            record_warnings.append(f"Field {field} value was corrected to: {closest_match}")

                if "custom_validator" in rules:
                    validator_func = rules["custom_validator"]
                    try:
                        if not validator_func(value):
                            record_errors.append(f"Field {field} failed custom validation")
                    except Exception as e:
                        record_errors.append(f"Custom validation error for {field}: {str(e)}")

        # Calculate some statistics
        for field, value in transformed_record.items():
            if field not in transformation_stats:
                transformation_stats[field] = {
                    "count": 0,
                    "null_count": 0,
                    "type_distribution": {},
                    "min_length": float('inf'),
                    "max_length": 0
                }

            stats = transformation_stats[field]
            stats["count"] += 1

            if value is None:
                stats["null_count"] += 1
            else:
                value_type = type(value).__name__
                stats["type_distribution"][value_type] = stats["type_distribution"].get(value_type, 0) + 1

                if isinstance(value, str):
                    length = len(value)
                    stats["min_length"] = min(stats["min_length"], length)
                    stats["max_length"] = max(stats["max_length"], length)

        # Add metadata
        transformed_record["_processing_timestamp"] = datetime.now().isoformat()
        transformed_record["_source_record_index"] = i
        transformed_record["_validation_errors"] = record_errors
        transformed_record["_validation_warnings"] = record_warnings

        # Decide whether to include this record
        if record_errors:
            error_count += len(record_errors)
            if skip_invalid_records:
                if enable_logging:
                    processing_log.append(f"Skipping record {i} due to validation errors")
                continue
            elif error_count > max_errors:
                if enable_logging:
                    processing_log.append(f"Maximum error limit reached ({max_errors})")
                break

        if record_warnings:
            warning_count += len(record_warnings)

        batch_data.append(transformed_record)
        processed_count += 1

        # Process batch if full
        if len(batch_data) >= batch_size:
            # Simulate batch processing
            batch_start_time = datetime.now()

            # Sort batch by a random field for no good reason
            if batch_data and len(batch_data[0]) > 1:
                random_field = random.choice(list(batch_data[0].keys()))
                try:
                    batch_data.sort(key=lambda x: str(x.get(random_field, "")))
                except:
                    pass  # Ignore sort errors

            # Add batch metadata
            for record in batch_data:
                record["_batch_id"] = f"batch_{len(transformed_data) // batch_size}"
                record["_batch_processing_time"] = (datetime.now() - batch_start_time).total_seconds()

            transformed_data.extend(batch_data)
            batch_data = []

            if enable_logging:
                processing_log.append(f"Processed batch of {batch_size} records")

    # Process remaining records in batch
    if batch_data:
        batch_start_time = datetime.now()
        for record in batch_data:
            record["_batch_id"] = f"batch_{len(transformed_data) // batch_size}"
            record["_batch_processing_time"] = (datetime.now() - batch_start_time).total_seconds()
        transformed_data.extend(batch_data)

    # Final processing based on output format
    if output_format == "csv":
        # Convert to CSV-friendly format (flatten nested structures)
        csv_data = []
        for record in transformed_data:
            flat_record = {}
            for key, value in record.items():
                if isinstance(value, (dict, list)):
                    flat_record[key] = str(value)
                else:
                    flat_record[key] = value
            csv_data.append(flat_record)
        transformed_data = csv_data

    elif output_format == "xml":
        # Convert to XML-friendly format
        xml_data = []
        for record in transformed_data:
            xml_record = {}
            for key, value in record.items():
                # Remove invalid XML characters
                clean_key = re.sub(r'[^a-zA-Z0-9_]', '_', str(key))
                xml_record[clean_key] = value
            xml_data.append(xml_record)
        transformed_data = xml_data

    # Clean up transformation stats
    for field, stats in transformation_stats.items():
        if stats["min_length"] == float('inf'):
            stats["min_length"] = 0

    # Generate final report
    processing_report = {
        "processed_count": processed_count,
        "error_count": error_count,
        "warning_count": warning_count,
        "transformation_stats": transformation_stats,
        "processing_log": processing_log if enable_logging else [],
        "total_processing_time": (datetime.now() - datetime.now()).total_seconds(),
        "output_format": output_format,
        "settings_used": {
            "strict_validation": strict_validation,
            "allow_missing_fields": allow_missing_fields,
            "max_errors": max_errors,
            "skip_invalid_records": skip_invalid_records,
            "batch_size": batch_size
        }
    }

    return transformed_data, processing_report