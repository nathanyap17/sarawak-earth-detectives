"""A model call stuck on the network must not hold the server for 300 s on shutdown or reload
(the local app showed "Could not reach the agency" while the old process waited).
AI-assisted: written with Claude Code."""
import asyncio
import threading
import time

import pytest

from app import main


def test_stuck_thread_does_not_hold_shutdown(monkeypatch):
    gate = threading.Event()
    exited = {}
    monkeypatch.setattr(main.os, "_exit", lambda code: exited.setdefault("code", code))

    async def scenario():
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, gate.wait, 30)      # a call that never comes back
        await asyncio.sleep(0.05)
        t0 = time.monotonic()
        await main._leave_stuck_threads(grace_s=0.5)
        took = time.monotonic() - t0
        gate.set()                                     # _exit is faked here, so free the thread ourselves
        return took

    took = asyncio.run(scenario())
    assert exited == {"code": 0} and took < 3


def test_clean_shutdown_does_not_exit(monkeypatch):
    monkeypatch.setattr(main.os, "_exit", lambda code: pytest.fail("exited although nothing was stuck"))

    async def scenario():
        await asyncio.get_running_loop().run_in_executor(None, time.sleep, 0.01)
        await main._leave_stuck_threads(grace_s=0.5)

    asyncio.run(scenario())
