"""Session store. In memory for now; Firestore replaces it behind the same interface (Phase 4).
The action log is what the Chief grades and what the Partner is allowed to see.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Session:
    id: str
    case_id: str
    nickname: str
    class_code: str | None
    created_at: str
    log: list[dict] = field(default_factory=list)  # {"at", "kind", ...}
    analyses: list[dict] = field(default_factory=list)  # AnalysisResult dumps
    partner_turns: int = 0

    def record(self, kind: str, **data) -> None:
        self.log.append({"at": now(), "kind": kind, **data})


class MemoryStore:
    def __init__(self) -> None:
        self._s: dict[str, Session] = {}
        self._lock = threading.Lock()

    def create(self, case_id: str, nickname: str, class_code: str | None) -> Session:
        s = Session(id=uuid.uuid4().hex, case_id=case_id, nickname=nickname,
                    class_code=class_code, created_at=now())
        with self._lock:
            self._s[s.id] = s
        return s

    def get(self, session_id: str) -> Session | None:
        return self._s.get(session_id)


store = MemoryStore()
