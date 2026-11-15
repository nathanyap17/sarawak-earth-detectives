"""The agency's activity log: one short line each time an agent, the code or a human editor does
something. Shown in the workspace so students and judges can see how the system works.

Lines are written by code from fixed wording and counts. They never contain a student's words,
a nickname, an answer key, or the text of a case that a human has not approved (rules 3, 4, 5).
AI-assisted: written with Claude Code."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from app import docs

log = logging.getLogger("agency")
COL = "agent_activity"


def record(agent: str, by: str, text: str, kind: str = "note") -> None:
    """agent: who (Scout, Data desk, Case Builder, Editor, Partner, Chief, Grader).
    by: "ai" | "code" | "human", so the page can show which steps a model touched."""
    now = datetime.now(timezone.utc)
    doc = {"at": now.isoformat(timespec="seconds"), "agent": agent, "by": by, "kind": kind, "text": text[:300]}
    log.info("activity %s (%s): %s", agent, by, text)
    try:
        docs.store().put(COL, f"{now.strftime('%Y%m%dT%H%M%S%f')}-{uuid.uuid4().hex[:6]}", doc)
    except Exception as e:  # the log must never break a student's request
        log.warning("activity not saved: %s", type(e).__name__)


def recent(n: int = 40) -> list[dict]:
    try:
        return docs.store().recent(COL, n)
    except Exception as e:
        log.warning("activity not read: %s", type(e).__name__)
        return []
