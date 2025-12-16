from __future__ import annotations

from typing import Any, Dict


def extract_schema(schema_like: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(schema_like, dict) and "schema" in schema_like and isinstance(schema_like["schema"], dict):
        return schema_like["schema"]
    return schema_like


def validate_output_against_schema(output: Any, schema_like: Dict[str, Any]) -> None:
    """Validate output against a JSON Schema or `{ schema: ... }` wrapper."""
    from jsonschema import ValidationError, validate

    schema_obj = extract_schema(schema_like)
    try:
        validate(instance=output, schema=schema_obj)
    except ValidationError as ve:  # let caller decide on retries
        raise ve

