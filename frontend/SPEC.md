**What**

- React + TypeScript app for editing a simple LLM flow graph.

**How To Run**

- `cd frontend && npm run dev` (port 5173). `npm run build` then `npm run preview` (port 5174).

**Structure**

- `src/App.tsx` — app shell, state, sidebar editor, persistence wiring.
- `src/graph/GraphCanvas.tsx` — React Flow wrapper (nodes, edges, selection).
- `src/nodes/*` — renderers: `entry`, `llm`, `router`, `mcp`, `end`.
- `src/db/sqlite.ts` — sql.js + LocalStorage snapshot.
- `src/types.ts` — node data shapes.

**Node Types** (keys → fields used)

- `entry` → `name`, `inputs: { key: string, value?: string }[]`.
- `llm` → `name`, `provider`, `model`, `system?`, `mcpServers: NodeID[]`, `inputs: { key: string, description: string }[]`, `responseSchema`, `outputPointers: JSONPointer[]`.
- `router` → `name`, `branches: string[]`.
- `mcp` → `name`, `url`, `token?`.
- `end` → `name`.

**Persistence**

- Local sqlite (`sql.js`) saved to LocalStorage key `llmflow_db_v1`.
- Tables: `nodes(id,type,x,y,data JSON)`, `edges(id,source,target,sourceHandle?,targetHandle?)`; version `PRAGMA user_version=2`.
- API: `initDB()`, `loadGraph()`, `saveGraph(nodes,edges)`.
- Guarantee: The entire `data` object for every node is stored verbatim as JSON in `nodes.data`. No filtering, no derived defaults. All properties set in the UI are persisted and reloaded unchanged.
- Migrations:
  - v2 adds `sourceHandle` and `targetHandle` to `edges` (auto‑migrated on startup).
  - Entry inputs changed from `string[]` to `{ key, value? }[]`; loader normalizes legacy shapes in memory and then persists the new shape on next save.

**Behavior**

- Loads DB on start; if empty, shows an empty canvas (no demo graph).
- Editing in sidebar updates node `data` (debounced) and triggers full‑graph `saveGraph`.
- Selection passes first selected node to sidebar.
- Each output port corresponds to a JSON Pointer (RFC 6901) in `outputPointers` (array). Adding/removing rows adds/removes output ports. No implicit defaults are added.
- LLM inputs are defined as a list of handles with `key` and `description`.
- Persistence fidelity: Response Schema is stored as raw string while typing and as parsed JSON object after blur (when valid). Either form is saved to `nodes.data.responseSchema` exactly as edited.

**UI/Interaction Specs**

- Nodes are visually differentiated by type-specific colors for clarity.
- Provide a visible "Add Node" control to insert a new node into the graph.
- Support removing the selected node via the Delete key (and update edges accordingly).
- LLM sidebar includes a checkbox list to choose MCP servers from existing MCP nodes (by node id/name).
- Entry sidebar includes an editor for key/value rows.
- Sidebar sections for LLM nodes:
- "LLM Settings": provider, model, system prompt, MCP servers, and Response Schema (JSON). Fields are empty by default.
- "Inputs": editor for input handles. Each row: `key` (short identifier) and `description` (longer text included in the prompt).
- "Outputs": JSON Pointers only (`outputPointers`). The Response Schema is not part of the Outputs section.

**LLM Inputs**

- `inputs`: each item defines one input handle with two user-facing properties:
  - `key` — short identifier, used as a label and variable name.
  - `description` — longer text that becomes part of the prompt message.

**Limits (current)**

- No execution/runtime; UI only.
- No edge labels or validation; basic handles only.
- Only LocalStorage snapshot import/export.

**Engine: OpenAPI Client**
er, used as a label and variable name.

- `description` — longer text that becomes part of the prompt message.

**Limits (current)**

- No execution/runtime; UI only.
- No edge labels or validation; basic handles only.
- Only LocalStorage snapshot import/export.

**Engine: OpenAPI Client**

- Runtime: `openapi-fetch` (typed client) + `openapi-typescript` (typegen from backend Swagger).
- Files:
  - `src/engine/backendClient.ts` — creates a typed client with `baseUrl` from `VITE_BACKEND_URL` (default `http://localhost:8000`).
  - `src/engine/__generated__/backend.ts` — generated types (placeholder committed; run generator to overwrite).
- Scripts:
  - `npm run gen:api` — uses env `BACKEND_OPENAPI_URL` to generate types, e.g. `BACKEND_OPENAPI_URL=http://localhost:8000/openapi.json npm run gen:api`.
- Usage:
  - `import { backendClient } from './engine/backendClient'`
  - `const res = await backendClient.GET('/health')`
