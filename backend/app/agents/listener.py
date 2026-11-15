"""The Listener: turns a short spoken question into text, for browsers without their own speech
recognition (Firefox, some in-app browsers) or when that service fails.

It only transcribes: the text then goes into the question box and through the Partner's guards
like anything typed. The audio is sent to Gemini on Vertex AI and is not stored by us.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import asyncio
import logging
import time

from app.agents.runtime import _env
from app.config import get_settings

log = logging.getLogger("agents")
MAX_BYTES = 1_500_000          # about 60 s of compressed speech; the button stops at 20 s
TYPES = ("audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac")
PROMPT = ("Transcribe the speech in this recording, in English, exactly as said. "
          "Return only the words, no quotes or notes. If there is no clear speech, return nothing. "
          "The speaker is a student in a science game about Sarawak's climate records; words they may use: "
          "Mann-Kendall, t-test, p-value, trend, significant, El Nino, La Nina, MERRA-2, NASA POWER, peat, haze, "
          "Kenyalang, Sarawak, Kuching, Miri, Bintulu, per decade, red herring, verdict.")
_client = None
_last_ok = -1e9
_tasks: set = set()


def _gen():
    global _client
    if _client is None:
        _env()
        from google import genai
        _client = genai.Client()
    return _client


async def transcribe(audio: bytes, mime: str, timeout: float = 22) -> tuple[str | None, str]:
    """(text or None, error)."""
    s = get_settings()
    if s.mock_agents:
        return None, "mock agents"
    from google.genai import types
    t0 = time.perf_counter()
    try:
        r = await asyncio.wait_for(_gen().aio.models.generate_content(
            model=s.model_name,
            contents=[types.Part.from_bytes(data=audio, mime_type=mime), PROMPT],
            config=types.GenerateContentConfig(max_output_tokens=120, temperature=0,
                                               thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"))),
            timeout)
    except Exception as e:  # noqa: BLE001 - any failure means "type it instead"
        log.info("agent=listener failed %.2fs %s", time.perf_counter() - t0, type(e).__name__)
        return None, type(e).__name__
    global _last_ok
    _last_ok = time.monotonic()
    text = " ".join((r.text or "").split()).strip().strip('"')[:300]
    log.info("agent=listener ok %.2fs chars=%d", time.perf_counter() - t0, len(text))
    return (text or None), ("" if text else "no speech")


async def _ping() -> None:
    s = get_settings()
    from google.genai import types
    t0 = time.perf_counter()
    try:
        await asyncio.wait_for(_gen().aio.models.generate_content(
            model=s.model_name, contents="Reply OK.",
            config=types.GenerateContentConfig(max_output_tokens=5,
                                               thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"))), 60)
        global _last_ok
        _last_ok = time.monotonic()
        log.info("agent=listener warm %.2fs", time.perf_counter() - t0)
    except Exception as e:  # noqa: BLE001
        log.info("agent=listener warm failed %s", type(e).__name__)


def keep_warm(idle_s: float = 240) -> None:
    """When a case starts: open the model connection in the background so the first spoken
    question isn't slow (the first call on a new connection can take half a minute)."""
    if get_settings().mock_agents or time.monotonic() - _last_ok < idle_s:
        return
    t = asyncio.get_running_loop().create_task(_ping())
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
