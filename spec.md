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
  - Definitions of each LLM node
    - **Name**
    - **Provider** (Anthropic, OpenAI, DeepSeek, …)
    - **Model**
    - **System prompt**
    - **JSON schema for responses**
    - **Output port properties**
    - **Target MCP server(s)**
  - Definitions of each MCP server
    - **Name**
    - **URL**
    - **API token** (optional)
  - LLM responses and logs
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
  - Every LLM must return JSON.
  - Output ports are mapped to keys inside the JSON.  
    e.g. if an LLM returns `{ "a": 1, "b": 2 }`, each port can select either `a` or `b`.
- **Error Handling**
  - The backend returns proper HTTP error status codes for any LLM or MCP failure.

## Node Types

| Type       | Description                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Entry**  | Accepts one or more user inputs and forwards them unchanged to the next node.                                            |
| **LLM**    | Performs an LLM call as defined.                                                                                         |
| **Router** | Has one upstream and multiple downstream connections. Determines the next node(s) based on the upstream LLM’s output.    |
| **MCP**    | Special node representing a Managed Compute Provider. Defined globally; referenced from LLM nodes. No inputs or outputs. |
| **End**    | Terminal node; has no outputs. Displays its input value in the footer.                                                   |
