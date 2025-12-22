from .adapter import lc_invoke_generic, provider_catalog, provider_capabilities

# Flattened registry: only id -> invoke callable
REGISTRY = {
    "openai": {"invoke": lc_invoke_generic},
    "anthropic": {"invoke": lc_invoke_generic},
    "deepseek": {"invoke": lc_invoke_generic},
    "google": {"invoke": lc_invoke_generic},
}


def list_providers():
    # Return the predefined catalog merged with dynamic availability (computed now)
    items = []
    for pid, _meta in provider_catalog().items():
        caps = provider_capabilities(pid)
        available = pid in REGISTRY and callable(REGISTRY[pid]["invoke"]) and caps.get("available", False)
        items.append({"id": pid, **caps, "available": available})
    return items
