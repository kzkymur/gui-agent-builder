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
- `entry` → `name`, `inputs: string[]`.
- `llm` → `name`, `provider`, `model`, `system?`, `mcpServers: NodeID[]`, `inputs: { key: string, description: string }[]`, `responseSchema`, `outputPointers: JSONPointer[]`.
- `router` → `name`, `branches: string[]`.
- `mcp` → `name`, `url`, `token?`.
- `end` → `name`.

**Persistence**
- Local sqlite (`sql.js`) saved to LocalStorage key `llmflow_db_v1`.
- Tables: `nodes(id,type,x,y,data JSON)`, `edges(id,source,target,sourceHandle?,targetHandle?)`; version `PRAGMA user_version=2`.
- API: `initDB()`, `loadGraph()`, `saveGraph(nodes,edges)`.

**Behavior**
- Loads DB on start; if empty, seeds a demo graph and saves it.
- Editing in sidebar updates node `data` (debounced) and triggers full‑graph `saveGraph`.
- Selection passes first selected node to sidebar.
 - Each output port corresponds to a JSON Pointer (RFC 6901) in `outputPointers` (array). Adding/removing rows adds/removes output ports. The label is implicit; the last path segment can be shown in the future.
 - LLM inputs are defined as a list of handles with `key` and `description`.

**UI/Interaction Specs**
- Nodes are visually differentiated by type-specific colors for clarity.
- Provide a visible "Add Node" control to insert a new node into the graph.
 - Support removing the selected node via the Delete key (and update edges accordingly).
 - LLM sidebar includes a checkbox list to choose MCP servers from existing MCP nodes (by node id/name).
 - Sidebar sections for LLM nodes:
   - "LLM Settings": provider, model, system prompt, MCP servers, and Response Schema (JSON).
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
