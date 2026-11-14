"""Tests never call Vertex AI or Firestore: canned agents, in-memory sessions."""
import os

os.environ["MOCK_AGENTS"] = "1"
os.environ["SESSION_BACKEND"] = "memory"
