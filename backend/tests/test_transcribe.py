"""Hold-to-talk fallback: only short audio, and only text comes back.
AI-assisted: written with Claude Code."""
import pytest
from fastapi.testclient import TestClient

from app.agents import listener
from app.main import app
from app.vault.store import root

pytestmark = pytest.mark.skipif(not (root() / "index.json").exists(), reason="vault not built")
client = TestClient(app)


def _sid():
    return client.post("/sessions", json={"case_id": "001", "nickname": "Tester"}).json()["id"]


def test_transcribe_rejects_non_audio_and_huge():
    sid = _sid()
    assert client.post(f"/sessions/{sid}/transcribe", content=b"hi", headers={"content-type": "text/plain"}).status_code == 415
    big = b"0" * (listener.MAX_BYTES + 1)
    assert client.post(f"/sessions/{sid}/transcribe", content=big, headers={"content-type": "audio/webm"}).status_code == 413


def test_transcribe_returns_text(monkeypatch):
    async def fake(audio, mime, timeout=15):
        assert mime == "audio/webm" and audio == b"abc"
        return "What does Mann-Kendall mean?", ""
    monkeypatch.setattr(listener, "transcribe", fake)
    sid = _sid()
    r = client.post(f"/sessions/{sid}/transcribe", content=b"abc", headers={"content-type": "audio/webm;codecs=opus"})
    assert r.status_code == 200 and r.json() == {"text": "What does Mann-Kendall mean?", "error": ""}
