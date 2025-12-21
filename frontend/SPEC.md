**What**

- React + TypeScript app for editing a simple LLM flow graph.

**How To Run**

- `cd frontend && npm run dev` (port 5173). `npm run build` then `npm run preview` (port 5174).
 - TypeScript: `npm run typecheck` runs `tsc --noEmit` against `tsconfig.json`. Build also runs `tsc -b` before Vite.
 - Biome (format + lint):
   - `npm run lint` — `biome check .` (no writes)
   - `npm run format` — `biome format .` (dry run)
   - `npm run fix` — `biome check --apply` + `biome format --write`
   - Config lives in `frontend/biome.json`; generated code and build output are ignored via `.biomeignore`.

**Structure**

- `src/App.tsx` — app shell, state, sidebar editor, persistence wiring.
- `src/graph/GraphCanvas.tsx` — React Flow wrapper (nodes, edges, selection).
- `src/nodes/*` — renderers: `entry`, `llm`, `switch`, `mcp`, `end`.
- `src/db/sqlite.ts` — sql.js + LocalStorage snapshot.
- `src/types.ts` — node data shapes.

**Node Types** (keys → fields used)

- `entry` → `name`, `inputs: { key: string, value?: string }[]`.
- `llm` → `name`, `provider`, `model`, `temperature?`, `maxTokens?`, `system?`, `mcpServers: NodeID[]`, `inputs: { key: string, description: string }[]`, `responseSchema`, `outputPointers: JSONPointer[]`.
- `switch` → `name`, `threshold?` (0..1, default 0.5).
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
  - v3 adds `settings(key PRIMARY KEY, value TEXT)` for app preferences/secrets (e.g., API key). Functions: `loadSettings()`, `saveSetting(key,value)`.

**Behavior**

- Loads DB on start; if empty, shows an empty canvas (no demo graph).
- Editing in sidebar updates node `data` (debounced) and triggers full‑graph `saveGraph`.
- Selection passes first selected node to sidebar.
- Each output port corresponds to a JSON Pointer (RFC 6901) in `outputPointers` (array). Adding/removing rows adds/removes output ports. No implicit defaults are added.
- LLM inputs are defined as a list of handles with `key` and `description`.
- Persistence fidelity: Response Schema is stored as raw string while typing and as parsed JSON object after blur (when valid). Either form is saved to `nodes.data.responseSchema` exactly as edited.
- Sidebar: A collapsed “Detail Settings” section lets users edit `provider`, `model`, `temperature`, and `maxTokens`. These map 1:1 to backend `/llm/invoke` fields; `maxTokens` is sent as `max_tokens`.

**UI/Interaction Specs**

- Nodes are visually differentiated by type-specific colors for clarity.
- Running nodes show an orange outline to indicate activity.
- Provide a visible "Add Node" control to insert a new node into the graph.
- Support removing the selected node via the Delete key (and update edges accordingly).
- LLM sidebar includes a checkbox list to choose MCP servers from existing MCP nodes (by node id/name).
- Entry sidebar includes an editor for key/value rows.
- Header includes API Key inputs on the right, one per provider returned by `GET /providers`. Keys persist to sqlite in a single record (`settings.api_keys` JSON). Adapters use the exact provider's key when present; `settings.api_key` remains a legacy fallback and `VITE_CLAUDE_API_KEY` is a final fallback.
- Sidebar is width‑resizable (drag the thin vertical divider between the graph and the sidebar). A small chevron button lives on the divider to hide/show the sidebar. Width and visibility persist to sqlite (`settings.sidebar_width`, `settings.sidebar_visible`).
- Sidebar occupies full height and scrolls internally; graph and sidebar share the viewport vertically under a constant-height footer.
- Footer is vertically resizable via a horizontal divider between the graph and footer. Height persists in settings (`settings.footer_height`). Double‑click the divider to reset to 200px.
- Footer is always visible with a constant height and shows End-node outputs when present; otherwise it displays a hint.
- Sidebar sections for LLM nodes:
- "LLM Settings": provider (dropdown populated from `GET /providers`), model, temperature (0–1 slider with Reset to use provider default), system prompt, MCP servers, and Response Schema (JSON). Fields are empty by default. The Response Schema is a plain JSON Schema object; no wrapper fields like `name` are used.
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

**Execution Engine (Immediate Forward Propagation)**
- State is global, ephemeral (Zustand). SQLite is config‑only. No queues: a node’s completion immediately propagates to its targets and invokes them asynchronously.
- Store (to implement `src/engine/store.ts`): `{ run, activeRunning: Map<actId,{nodeId,startedAt}>, inputBufByNode, latestInputByNode, latestOutputByNode, trace:{nodes,roots} }`.
- Ignite: build `{key:value}` from Entry nodes, write latest/input buffers, append root trace nodes, and call `runNode(entryId)` immediately.
- runNode: if already running, return; snapshot `inputBufByNode[nodeId]`, write a trace start, await adapter (Entry/LLM/Switch/End), then update trace and latestOutput and call `propagate`.
- propagate: for each outgoing edge, derive values by handle rules (Entry out‑i, LLM out‑i via `outputPointers[i]`, Switch forwards `{ value: signal }` only when its gate ≥ threshold), merge into `inputBufByNode[target]`, coalesce same‑tick triggers, and schedule `runNode(target)` via microtask; finalize when none are running/scheduled.
