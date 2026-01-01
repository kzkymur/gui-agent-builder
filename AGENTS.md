# Repository Guidelines

> This AGENTS.md guides contributors (humans and agents) working on the `llm-flow` repo. Keep changes focused and small.

## AI Contribution Guardrails

- Update the relevant specification file before writing or modifying code; land spec updates in the same PR.
- Be brief and useful. Prefer minimal diffs and plain language over exhaustive prose.
- Do not generate new docs unless a maintainer requested them and names an owner. Update only code-adjacent docs touched by the change.
- Do not invent or declare config/options/fields that are unused. Remove dead flags and properties instead of adding more.
- Avoid speculative abstractions and meta-frameworks. YAGNI applies: simplest working change wins.
- Keep comments practical (why over what). No narrative summaries of obvious code.
- New files require justification in the PR description: purpose, owner, and maintenance plan.

## Architecture Roles (For Coding Agents)

- Frontend = LLM orchestration. The FE owns prompt/message assembly, node graph execution, and sending normalized invoke payloads (provider, model, messages, response_schema, controls). FE may pass user-selected tool toggles and credentials as headers/fields but does not execute tools.
- Backend = Tool orchestration. The BE owns binding and execution of tools (e.g., MCP, Tavily) and provider-specific adapters. The BE decides when/how tools are exposed to models and returns a normalized result. Keep FE stateless about tool internals and keep BE stateless about graph state.
