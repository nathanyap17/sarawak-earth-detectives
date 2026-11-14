"""Session store: in memory (local, tests) or Firestore (cloud), same interface.
`SESSION_BACKEND=firestore` keeps sessions across Cloud Run restarts and instances.
The action log is what the Chief grades and what the Partner is allowed to see.
Nicknames only: no personal data is stored (rule 5).
AI-assisted: written with Claude Code."""
from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass, field, fields
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
    chosen: list[str] = field(default_factory=list)
    clue_pins: list[list[float]] = field(default_factory=list)
    verdicts: list[dict] = field(default_factory=list)
    grade: dict | None = None
    partner_chat: list[dict] = field(default_factory=list)  # {"q", "a", "beat", "rung", "source"}
    _log0: int = field(default=0, repr=False, compare=False)  # log entries already saved

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

    def save(self, s: Session, *names: str) -> None:  # objects live in memory already
        s._log0 = len(s.log)


FIELDS = [f.name for f in fields(Session) if not f.name.startswith("_")]


def _to_doc(s: Session, names) -> dict:
    d = {k: v for k, v in asdict(s).items() if k in names}
    if "clue_pins" in d:  # Firestore can't store arrays of arrays
        d["clue_pins"] = [{"lon": p[0], "lat": p[1]} for p in d["clue_pins"]]
    return d


def _from_doc(d: dict) -> Session:
    d = {k: v for k, v in d.items() if k in FIELDS}
    d["clue_pins"] = [[p["lon"], p["lat"]] for p in d.get("clue_pins", [])]
    s = Session(**d)
    s._log0 = len(s.log)
    return s


class FirestoreStore:
    """Reads the document on every request (correct with several instances); writes only the
    fields a route changed, and appends log entries, so concurrent requests don't overwrite."""

    def __init__(self, project: str | None) -> None:
        from google.cloud import firestore

        self._fs = firestore
        self._col = firestore.Client(project=project).collection("sessions")

    def create(self, case_id: str, nickname: str, class_code: str | None) -> Session:
        s = Session(id=uuid.uuid4().hex, case_id=case_id, nickname=nickname,
                    class_code=class_code, created_at=now())
        self._col.document(s.id).set(_to_doc(s, FIELDS))
        return s

    def get(self, session_id: str) -> Session | None:
        if not session_id.isalnum() or len(session_id) > 64:
            return None
        snap = self._col.document(session_id).get()
        return _from_doc(snap.to_dict()) if snap.exists else None

    def save(self, s: Session, *names: str) -> None:
        upd = _to_doc(s, [n for n in names if n != "log"])
        new = s.log[s._log0:]
        if new:
            upd["log"] = self._fs.ArrayUnion(new)
        if upd:
            self._col.document(s.id).update(upd)
        s._log0 = len(s.log)


def _make():
    from app.config import get_settings

    st = get_settings()
    return FirestoreStore(st.google_cloud_project) if st.session_backend == "firestore" else MemoryStore()


store = _make()
