from __future__ import annotations

from typing import Any, Dict, List


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


def enforce_no_additional_properties_deep(schema_obj: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively enforce additionalProperties: false for all object schemas when absent.

    - Does not override when additionalProperties is explicitly set.
    - Traverses common schema composition keywords: properties, items, oneOf, anyOf, allOf, not, if/then/else.
    - Returns a new object; does not mutate the input.
    """
    def _walk(node: Any) -> Any:
        if isinstance(node, dict):
            node_type = node.get("type")
            changed = False
            out: Dict[str, Any] = dict(node)
            if node_type == "object" and "additionalProperties" not in out:
                out["additionalProperties"] = False
                changed = True
            # properties
            props = out.get("properties")
            if isinstance(props, dict):
                new_props: Dict[str, Any] = {}
                did = False
                for k, v in props.items():
                    new_v = _walk(v)
                    new_props[k] = new_v
                    did = did or (new_v is not v)
                if did:
                    out["properties"] = new_props
                    changed = True
            # items can be schema or list of schemas
            if "items" in out:
                it = out.get("items")
                if isinstance(it, list):
                    new_list: List[Any] = []
                    did = False
                    for v in it:
                        new_v = _walk(v)
                        new_list.append(new_v)
                        did = did or (new_v is not v)
                    if did:
                        out["items"] = new_list
                        changed = True
                else:
                    new_it = _walk(it)
                    if new_it is not it:
                        out["items"] = new_it
                        changed = True
            # compositions
            for key in ("oneOf", "anyOf", "allOf"):
                if key in out and isinstance(out[key], list):
                    arr = out[key]
                    new_arr: List[Any] = []
                    did = False
                    for v in arr:
                        new_v = _walk(v)
                        new_arr.append(new_v)
                        did = did or (new_v is not v)
                    if did:
                        out[key] = new_arr
                        changed = True
            # conditionals
            for key in ("not", "if", "then", "else"):
                if key in out:
                    new_v = _walk(out[key])
                    if new_v is not out[key]:
                        out[key] = new_v
                        changed = True
            return out if changed else node
        elif isinstance(node, list):
            new_list: List[Any] = []
            did = False
            for v in node:
                new_v = _walk(v)
                new_list.append(new_v)
                did = did or (new_v is not v)
            return new_list if did else node
        return node

    return _walk(schema_obj)


def enforce_required_all_properties_deep(schema_obj: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively ensure that for every object schema, `required` includes every key in `properties`.

    This matches OpenAI's strict JSON schema requirement. If `properties` is present but `required` is missing
    or incomplete, we set `required` to the full list of property keys. Nested schemas are processed too.
    """
    def _walk(node: Any) -> Any:
        if isinstance(node, dict):
            changed = False
            out: Dict[str, Any] = dict(node)
            props = out.get("properties")
            if isinstance(props, dict):
                # Recurse into properties
                new_props: Dict[str, Any] = {}
                props_changed = False
                for k, v in props.items():
                    new_v = _walk(v)
                    new_props[k] = new_v
                    props_changed = props_changed or (new_v is not v)
                if props_changed:
                    out["properties"] = new_props
                    changed = True
                # Ensure required covers all property keys
                keys = list(new_props.keys())
                required = out.get("required")
                if not isinstance(required, list) or set(required) != set(keys):
                    out["required"] = keys
                    changed = True
            # items and compositions
            if "items" in out:
                it = out.get("items")
                if isinstance(it, list):
                    new_list: List[Any] = []
                    did = False
                    for v in it:
                        new_v = _walk(v)
                        new_list.append(new_v)
                        did = did or (new_v is not v)
                    if did:
                        out["items"] = new_list
                        changed = True
                else:
                    new_it = _walk(it)
                    if new_it is not it:
                        out["items"] = new_it
                        changed = True
            for key in ("oneOf", "anyOf", "allOf"):
                if key in out and isinstance(out[key], list):
                    arr = out[key]
                    new_arr: List[Any] = []
                    did = False
                    for v in arr:
                        new_v = _walk(v)
                        new_arr.append(new_v)
                        did = did or (new_v is not v)
                    if did:
                        out[key] = new_arr
                        changed = True
            for key in ("not", "if", "then", "else"):
                if key in out:
                    new_v = _walk(out[key])
                    if new_v is not out[key]:
                        out[key] = new_v
                        changed = True
            return out if changed else node
        elif isinstance(node, list):
            new_list: List[Any] = []
            did = False
            for v in node:
                new_v = _walk(v)
                new_list.append(new_v)
                did = did or (new_v is not v)
            return new_list if did else node
        return node

    return _walk(schema_obj)


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
