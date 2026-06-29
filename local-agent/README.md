# Local Agent (MacBook Air M1 / 16GB)

Two-lane setup so your **Cursor workflow stays the same**, plus a fully local/offline agent.

- **Lane 1 — Cursor**: native MCP. Config at `../.cursor/mcp.json`. Use Cursor's cloud models as usual; your 5 MCP tools are attached to the Agent.
- **Lane 2 — Open WebUI + Ollama**: the *same* 5 MCP servers exposed locally via `mcpo`, driven by the local `coder-agent` model (`qwen2.5-coder:7b`).

## Files

- `Modelfile` — builds the `coder-agent` Ollama model (16k context, low temp, agent system prompt).
- `mcp-config.json` — the 5 MCP servers (filesystem, git, github, fetch, browser).

## One-time setup (already done)

```bash
ollama pull qwen2.5-coder:7b
ollama create coder-agent -f Modelfile      # build the agent model
brew install uv                             # provides uvx for python MCP servers
```

Add your GitHub token: edit `mcp-config.json` AND `../.cursor/mcp.json`, replace
`REPLACE_WITH_YOUR_GH_TOKEN` with a PAT (https://github.com/settings/tokens).

## Start the local agent (Lane 2)

> Port 8000 is taken by the church app (`server.py`). The bridge runs on **8200**.

```bash
cd local-agent
uvx mcpo --config mcp-config.json --port 8200
```

Leave this running in its own terminal. Verify: open http://localhost:8200/docs

### Connect Open WebUI

1. Run Open WebUI (it auto-detects Ollama at `http://localhost:11434`).
2. Settings -> Tools -> **Add Connection** for each server:
   - `http://localhost:8200/filesystem`
   - `http://localhost:8200/git`
   - `http://localhost:8200/github`
   - `http://localhost:8200/fetch`
   - `http://localhost:8200/browser`
3. In a chat, pick model **coder-agent** and enable the tools.

## M1 / 16GB memory rules

- Run the **7B** (`coder-agent`), not `qwen3-coder` (18GB -> will swap/OOM).
- Docker Desktop -> Settings -> Resources -> cap RAM to ~4GB; quit it when running the model.
- The **browser** server launches Chromium (heavy) — only enable it when a task needs the web.
- MCP servers are stdio/on-demand, so they don't hold RAM when idle.

## Stop

```bash
pkill -f "mcpo --config"
```
