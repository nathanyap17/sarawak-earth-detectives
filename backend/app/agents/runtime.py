"""Run an ADK LlmAgent once, with a hard timeout (EXP-6: gemini-3.5-flash-lite @ global; the Partner
runs on its own model, settings.partner_model_name).
Each call gets a fresh ADK session; the caller passes all context in the prompt, so the agent
never holds state the code didn't give it.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import asyncio
import logging
import os
import time

from app.config import get_settings

log = logging.getLogger("agents")
_runners: dict[str, object] = {}


def _env() -> None:
    s = get_settings()
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "TRUE")
    if s.google_cloud_project:
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", s.google_cloud_project)
    os.environ["GOOGLE_CLOUD_LOCATION"] = s.google_cloud_location  # model endpoint, not the app region


def _runner(name: str, instruction: str, max_tokens: int | None = None, as_json: bool = False):
    if name not in _runners:
        _env()
        from google.adk.agents import LlmAgent
        from google.adk.runners import InMemoryRunner
        from google.genai import types

        s = get_settings()
        partner = name == "partner"
        agent = LlmAgent(
            name=name, model=s.partner_model_name if partner else s.model_name, instruction=instruction,
            generate_content_config=types.GenerateContentConfig(
                max_output_tokens=max_tokens or s.partner_max_output_tokens, temperature=0.4,
                response_mime_type="application/json" if as_json else None,
                thinking_config=types.ThinkingConfig(
                    thinking_level=s.partner_thinking_level if partner else s.thinking_level)))
        _runners[name] = InMemoryRunner(agent=agent, app_name=f"sed-{name}")
    return _runners[name]


async def _run(name: str, instruction: str, prompt: str, max_tokens: int | None = None, as_json: bool = False) -> str:
    from google.genai import types

    r = _runner(name, instruction, max_tokens, as_json)
    sess = await r.session_service.create_session(app_name=f"sed-{name}", user_id="student")
    out = ""
    async for ev in r.run_async(user_id="student", session_id=sess.id,
                                new_message=types.Content(role="user", parts=[types.Part(text=prompt)])):
        if ev.content and ev.content.parts:
            out += "".join(p.text or "" for p in ev.content.parts if not getattr(p, "thought", False))
    return out.strip()


async def run_once(name: str, instruction: str, prompt: str, timeout: float | None = None,
                   max_tokens: int | None = None, as_json: bool = False) -> tuple[str | None, float, str]:
    """(text or None, seconds, error). None means: use the deterministic fallback."""
    s = get_settings()
    if s.mock_agents:
        return None, 0.0, "mock"
    t0 = time.perf_counter()
    try:
        default = s.partner_timeout_s if name == "partner" else s.model_timeout_s
        text = await asyncio.wait_for(_run(name, instruction, prompt, max_tokens, as_json), timeout or default)
        dt = time.perf_counter() - t0
        log.info("agent=%s ok %.2fs chars=%d", name, dt, len(text))
        _last_ok[name] = time.monotonic()
        return (text or None), dt, "" if text else "empty"
    except asyncio.TimeoutError:
        dt = time.perf_counter() - t0
        log.warning("agent=%s timeout %.2fs", name, dt)
        return None, dt, "timeout"
    except Exception as e:  # model or network error: the student still gets a hint
        dt = time.perf_counter() - t0
        log.warning("agent=%s error %s: %s", name, type(e).__name__, str(e)[:200])
        return None, dt, type(e).__name__


async def warm(name: str, instruction: str) -> None:
    """Hide the 10–27 s first-call cold start (EXP-6) by calling once at startup."""
    _last_ok[name] = time.monotonic()
    text, _, _ = await run_once(name, instruction, "Say: ready", timeout=40)
    if text is None:
        _last_ok.pop(name, None)


_last_ok: dict[str, float] = {}
_tasks: set[asyncio.Task] = set()


def keep_warm(name: str, instruction: str, idle_s: float = 240) -> None:
    """Called when a student starts a case: if the agent has been idle a while, warm it in the
    background so their first question doesn't pay the model's cold start. Never blocks."""
    if get_settings().mock_agents or time.monotonic() - _last_ok.get(name, -1e9) < idle_s:
        return
    t = asyncio.get_running_loop().create_task(warm(name, instruction))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
