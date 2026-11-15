"""A small document store for what the agency writes while it runs: cases drafted by the
Scout and Case Builder, their answer keys (server only, rule 3) and the agents' activity log.
Files under data/agency locally and in tests; Firestore in the cloud (same switch as sessions).
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json
import re
from pathlib import Path

from app.config import get_settings

_SAFE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class FileDocs:
    def __init__(self, base: Path) -> None:
        self.base = base

    def _dir(self, col: str) -> Path:
        d = self.base / col
        d.mkdir(parents=True, exist_ok=True)
        return d

    def get(self, col: str, doc_id: str) -> dict | None:
        if not _SAFE.match(doc_id):
            return None
        p = self._dir(col) / f"{doc_id}.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None

    def put(self, col: str, doc_id: str, doc: dict) -> None:
        (self._dir(col) / f"{doc_id}.json").write_text(json.dumps(doc, indent=1), encoding="utf-8")

    def all(self, col: str) -> list[dict]:
        return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(self._dir(col).glob("*.json"))]

    def recent(self, col: str, n: int) -> list[dict]:
        """Newest first. Ids are time-ordered, so the file name is the sort key."""
        files = sorted(self._dir(col).glob("*.json"), reverse=True)
        for old in files[400:]:  # keep the log small
            old.unlink(missing_ok=True)
        return [json.loads(p.read_text(encoding="utf-8")) for p in files[:n]]


class FirestoreDocs:
    def __init__(self, project: str | None) -> None:
        from google.cloud import firestore

        self._fs = firestore
        self._db = firestore.Client(project=project)

    def get(self, col: str, doc_id: str) -> dict | None:
        if not _SAFE.match(doc_id):
            return None
        snap = self._db.collection(col).document(doc_id).get()
        return snap.to_dict() if snap.exists else None

    def put(self, col: str, doc_id: str, doc: dict) -> None:
        self._db.collection(col).document(doc_id).set(doc)

    def all(self, col: str) -> list[dict]:
        return [s.to_dict() for s in self._db.collection(col).stream()]

    def recent(self, col: str, n: int) -> list[dict]:
        q = self._db.collection(col).order_by("at", direction=self._fs.Query.DESCENDING).limit(n)
        return [s.to_dict() for s in q.stream()]


_store = None


def store():
    global _store
    if _store is None:
        st = get_settings()
        _store = (FirestoreDocs(st.google_cloud_project) if st.session_backend == "firestore"
                  else FileDocs(st.data_dir / "agency"))
    return _store


def use(s) -> None:
    """Tests point the store at a temporary folder."""
    global _store
    _store = s
