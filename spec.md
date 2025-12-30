# Local LLM & MCP Orchestration Platform

## Goal

- Recreate locally what the combination of LangGraph, LangChain, and LangSmith provides.
- Deliver an application that allows easy orchestration of LLMs and MCPs through a node‑based GUI.
- Include meta‑programming capabilities.

## Technology Stack

### Backend

- Python
- FastAPI

### Frontend

- React
- TypeScript
- Vite
- React Flow
- SQLite WASM
- Radix UI

## Design Philosophy

### Frontend‑Driven

- The backend only forwards calls to external LLM APIs.
- All state is stored in the frontend’s SQLite WASM database, including:
  - The orchestration graph structure.
  - Definitions of each LLM node (stored verbatim as JSON in `nodes.data`)
    - **Name**
    - **Provider** (Anthropic, OpenAI, DeepSeek, …)
    - **Model**
    - **Temperature** (optional, 0–2)
    - **Max Tokens** (optional)
    - **System prompt**
    - **Response JSON Schema** (`responseSchema`) — edited in the LLM Settings section of the sidebar. Stored as a plain JSON Schema object (no wrapper fields).
    - **Inputs (handles) with key and description** (`inputs`)
    - **Outputs mapped by JSON Pointer** (`outputPointers`)
    - **Target MCP server(s)**
  - Definitions of each MCP server
    - **Name**
    - **URL**
    - **API token** (optional)
  - LLM responses and logs
  - Guarantee: every property edited in the UI is persisted without alteration. There are no hidden defaults written to storage; any defaults are UI‑only and not serialized.
- The frontend walks the graph sequentially, invoking each node’s LLM API via the backend.  
  The response of one node becomes the input of the next.

## Detailed Design

- **Layout**: Graph UI, footer, sidebar.
- **Graph UI**: Implemented with React Flow.
- **Node Interaction**
  - Nodes expose input and output ports.
  - A single output port may connect to multiple input ports, enabling fan‑out to multiple LLMs.
  - Clicking a node opens its editable definition in the sidebar.
- **LLM Response Handling**
  - Every LLM must return JSON that validates against the node’s `responseSchema` (JSON Schema).
  - Output ports are defined as JSON Pointers (RFC 6901) into that response.  
    Example: For `{ "a": { "b": 2 } }`, a port may point to `/a/b`.
  
- **LLM Inputs**
  - Each LLM node declares `inputs` — a list of input handles composed of two properties: `key` (short identifier) and `description` (longer text used in the prompt).
  - Both `key` and `description` are edited by the user in the sidebar. No binding to upstream nodes is defined at this time.

## Sidebar: LLM Detail Settings
- The LLM editor exposes a “Detail Settings” toggle containing `provider`, `model`, `temperature`, and `maxTokens`.
- These values are persisted verbatim on the node and forwarded to the backend `/llm/invoke` as `provider`, `model`, `temperature`, and `max_tokens` (converted to snake_case for the request).

## Execution Engine (Immediate Forward Propagation)
- State lives in a global Zustand store (frontend) and is ephemeral. SQLite keeps only graph/config.
- Ignite starts a run from Entry nodes: build `{key:value}` input per Entry, write snapshots, and invoke the Entry adapter immediately.
- When a node finishes, the engine propagates its output along outgoing edges, merges target inputs, and immediately invokes targets whose inputs changed. This chaining grows the I/O trace tree (no queues).
- Adapters: Entry echoes input; LLM composes messages and calls backend `/llm/invoke` (structured output when `responseSchema` is an object); Router selects branches; End echoes input.
- Run ends when no node is running or scheduled; errors annotate the trace and set status failed unless cancelled.
- **Error Handling**
  - The backend returns proper HTTP error status codes for any LLM or MCP failure.

### Node I/O Persistence
- Each node persists its own Input and Output to the in‑browser SQLite (sql.js/wasm) database when its action completes.
- A new table `node_io` records one row per node completion with columns:
  - `id INTEGER PRIMARY KEY`, `nodeId TEXT`, `runId TEXT`, `traceId TEXT`, `input TEXT`, `output TEXT`, `ts INTEGER`.
- Propagation performs a pre‑action readiness check using current input handles. If ready, the node action is invoked; otherwise it waits until inputs are prepared.

## Frontend Layout

- `frontend/`
  - `index.html` – app mount and base styles.
  - `src/` – React code (TypeScript).
    - `main.tsx` – app bootstrap.
    - `App.tsx` – shell with Graph UI placeholder.
    - `index.css` – global styles.
  - `vite.config.ts` – Vite config for React/TS.
  - `tsconfig*.json` – TypeScript configs.
  - `package.json` – scripts: `dev`, `build`, `preview`, `typecheck`.

## Node Types

| Type       | Description                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Entry**  | Accepts one or more user inputs and forwards them unchanged to the next node.                                            |
| **LLM**    | Performs an LLM call as defined.                                                                                         |
| **Switch** | Two inputs (gate, signal) and one output. Gate accepts number or boolean (false→0, true→1); forwards signal when gate ≥ threshold (configurable in sidebar). |
| **MCP**    | Special node representing a Managed Compute Provider. Defined globally; referenced from LLM nodes. No inputs or outputs. |
| **End**    | Terminal node; has no outputs. Displays its input value in the footer.                                                   |
