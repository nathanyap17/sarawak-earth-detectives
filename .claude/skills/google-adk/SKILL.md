---
name: google-adk
description: Reference for building agents with Google ADK (Agent Development Kit) in Python. Use whenever writing or modifying agent code - LlmAgent, LoopAgent, SequentialAgent, ParallelAgent, FunctionTool, AgentTool, sub_agents, session state, callbacks, runners, or LiteLLM/Gemini model integration. Also use when debugging agent loops that don't terminate, tools the model ignores or calls with missing arguments, or model configuration errors.
---

# Google ADK reference

## Local source of truth

The official docs and source are cloned next to this repo (paths relative to the repo root). Pinned: `google-adk==2.14.1` in `backend/pyproject.toml`; `../adk-python` at tag `v2.14.1` (ae1265b1); `../adk-docs` at main `9c7037a5` (2026-11-13). If you upgrade the package, rerun the adk-workspace-setup script with `backend/.venv/Scripts/python`. **Read them rather than relying on memory**; the API changes between releases.

```
../adk-docs/      # documentation (markdown; llms-full.txt = everything in one file)
../adk-python/    # source, checked out at the installed version's tag
```

**Lookup order:**
1. `../adk-docs/docs/agents/`, `../adk-docs/docs/tools/`, `../adk-docs/docs/sessions/`: concepts and recommended patterns
2. `../adk-python/src/google/adk/agents/`: real class signatures
3. `../adk-python/src/google/adk/tools/`: how tools are wrapped and invoked
4. Only then, general knowledge

```bash
grep -rn "class LoopAgent" ../adk-python/src/
grep -rn "max_iterations\|escalate" ../adk-python/src/google/adk/agents/
grep -rn "_prepare_invocation_args" ../adk-python/src/google/adk/tools/
```

## Choosing an agent type

| Type | Use |
|---|---|
| `LlmAgent` / `Agent` | Reasoning, routing, choosing tools |
| `LoopAgent` | Repeat sub-agents until one escalates or `max_iterations` is reached |
| `SequentialAgent` | A fixed pipeline; sub-agents pass results through session state (`output_key`) |
| `ParallelAgent` | Independent work fanned out at once |
| `AgentTool(agent=…)` | Let a parent call an agent as a bounded step and keep control afterwards (works for LoopAgents too) |

## Patterns that hold up

1. **Every loop is bounded.** Always set `max_iterations`, and give it an `escalate` path. An unbounded loop hangs a demo.
2. **Termination is decided by code, not the model.** A small `BaseAgent` checker reads real state (database, files) and yields `Event(actions=EventActions(escalate=done))`. The model only decides what to say or do next.
3. **Tool parameters are flat.** Give tool functions scalar or list parameters (`def get_weather(farm_id: str)`), not a single Pydantic model as the whole parameter. In some ADK versions a lone `req: SomeModel` parameter is flattened into the schema the model sees but not rebuilt before the call, so every call fails with "mandatory input parameters are not present". Check `FunctionTool._prepare_invocation_args` in the installed source before relying on model parameters. Return Pydantic models freely.
4. **Docstrings are the tool description the model reads.** Say what it does, when to call it, what each argument means, and what it returns. Vague docstrings cause skipped or misused tools.
5. **Data the machine already has never comes from the model.** Load graphs, records and configuration inside the tool from the database; the model passes only an id.
6. **Wrap tools with an error boundary** that returns a structured error the model can read, instead of raising and killing the run.
7. **Bound every model turn** with `asyncio.wait_for(…, timeout=…)` and have a deterministic fallback when it times out or returns unparseable output.
8. **Guard the output.** After the run, validate what the model produced against your rules (known ids, allowed actions, dates) and correct or drop anything outside them. Log each correction.
9. **Log every tool call** (`before_tool_callback` / `after_tool_callback`): name, args, latency, result summary. It's your audit trail and your demo evidence.
10. **Need a sub-agent's intermediate outputs?** `AgentTool` returns only the final text. Run the sub-agent with its own `InMemoryRunner` and read `session.state` afterwards.

## Models

```python
from google.adk.models.lite_llm import LiteLlm
model = LiteLlm(model="vertex_ai/gemini-2.5-flash")   # cloud (ADC auth)
# This project: plain model string + GOOGLE_GENAI_USE_VERTEXAI=TRUE, e.g. LlmAgent(model=settings.model_name)
model = LiteLlm(model="ollama_chat/qwen2.5:14b")      # local
```
Switch by configuration (an env var), never by code branches. Small local models often can't call tools reliably; test tool calling before building on a model. On Vertex AI, the model's region can differ from your app's region; confirm the model is available where you call it.

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Loop never ends | No escalate and no `max_iterations` | Set both |
| Model ignores a tool | Vague docstring | Rewrite it for the model |
| "mandatory input parameters are not present" | Single-model parameter not rebuilt | Use flat parameters |
| Model calls dependent tools in parallel | No ordering instruction | Instruct "one tool at a time; wait for results"; clamp bad inputs in the tool |
| Run hangs on a local model | No timeout | `wait_for` + deterministic fallback |
| State lost between steps | Not using session state / `output_key` | See `../adk-docs/docs/sessions/` |

## Before writing agent code

1. Grep the signature in `../adk-python/src/`.
2. Check `../adk-docs/` for the current recommended pattern.
3. Confirm the tool's input/output models exist and parameters are flat.
4. Confirm every loop has `max_iterations` and a code-based checker.
