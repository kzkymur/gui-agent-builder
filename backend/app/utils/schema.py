from __future__ import annotations

from typing import Any, Dict


def extract_schema(schema_like: Dict[str, Any]) -> Dict[str, Any]:
    """Return the JSON Schema object from input.

    Expected shape (2025-12-21): pass the schema object directly.
    """
    return schema_like


def enforce_no_additional_properties(schema_obj: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure root object schemas disallow extra keys by default.

    If the root has `type: "object"` and does not explicitly set
    `additionalProperties`, force it to `False`.
    This does not recurse; nested objects are honored as provided.
    """
    if isinstance(schema_obj, dict):
        t = schema_obj.get("type")
        if t == "object" and "additionalProperties" not in schema_obj:
            # make a shallow copy to avoid mutating caller data
            s2 = {**schema_obj, "additionalProperties": False}
            return s2
    return schema_obj


def validate_output_against_schema(output: Any, schema_like: Dict[str, Any]) -> None:
    """Validate output against a JSON Schema.

    Enforces `additionalProperties: false` at the root object level
    when not explicitly provided.
    """
    from jsonschema import ValidationError, validate

    schema_obj = enforce_no_additional_properties(extract_schema(schema_like))
    try:
        validate(instance=output, schema=schema_obj)
    except ValidationError as ve:  # let caller decide on retries
        raise ve
