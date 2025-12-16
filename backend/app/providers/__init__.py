from .adapter import lc_invoke_generic, provider_catalog, provider_capabilities

REGISTRY = {
    # LangChain-backed providers (extend as needed)
    "openai": {"invoke": lc_invoke_generic, "capabilities": provider_capabilities("openai")},
    "anthropic": {"invoke": lc_invoke_generic, "capabilities": provider_capabilities("anthropic")},
    "deepseek": {"invoke": lc_invoke_generic, "capabilities": provider_capabilities("deepseek")},
}


def list_providers():
    # Return the predefined catalog merged with dynamic availability
    items = []
    for pid, meta in provider_catalog().items():
        caps = provider_capabilities(pid)
        available = pid in REGISTRY and callable(REGISTRY[pid]["invoke"]) and caps.get(
            "available", False
        )
        items.append({"id": pid, **caps, "available": available})
    return items
