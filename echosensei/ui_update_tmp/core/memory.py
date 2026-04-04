import json
import os
import uuid
from datetime import datetime

SESSIONS_DIR = "data/sessions"

def _ensure_dir():
    os.makedirs(SESSIONS_DIR, exist_ok=True)

def _session_path(session_id: str) -> str:
    return os.path.join(SESSIONS_DIR, f"{session_id}.json")


# ── Legacy flat memory (kept for backward compatibility) ──────────────────────
MEMORY_FILE = "data/memory.json"

def load_memory() -> dict:
    if not os.path.exists(MEMORY_FILE):
        return {}
    with open(MEMORY_FILE, "r") as f:
        return json.load(f)

def save_memory(data: dict):
    os.makedirs("data", exist_ok=True)
    with open(MEMORY_FILE, "w") as f:
        json.dump(data, f, indent=2)

def update_memory(old: dict, new: dict) -> dict:
    old.update({k: v for k, v in new.items() if v not in ("", 0, None)})
    save_memory(old)
    return old


# ── Session-based memory ──────────────────────────────────────────────────────

def new_session(domain: str = "general") -> str:
    """Create a new session and return its ID."""
    _ensure_dir()
    session_id = str(uuid.uuid4())[:8]
    session = {
        "session_id": session_id,
        "domain": domain,
        "created_at": datetime.now().isoformat(),
        "turn": 0,
        "data": {},
        "history": []   # list of per-turn snapshots
    }
    with open(_session_path(session_id), "w") as f:
        json.dump(session, f, indent=2)
    return session_id


def load_session(session_id: str) -> dict:
    """Load an existing session. Returns empty dict if not found."""
    path = _session_path(session_id)
    if not os.path.exists(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)


def update_session(session_id: str, new_data: dict, domain: str = None) -> dict:
    """
    Merge new extracted fields into the session.
    Skips empty/null values so earlier valid data isn't overwritten.
    Returns the updated session dict.
    """
    _ensure_dir()
    session = load_session(session_id)
    if not session:
        session = {
            "session_id": session_id,
            "domain": domain or "general",
            "created_at": datetime.now().isoformat(),
            "turn": 0,
            "data": {},
            "history": []
        }

    session["turn"] += 1
    if domain:
        session["domain"] = domain

    # Merge: only overwrite if new value is non-empty
    for k, v in new_data.items():
        if v not in ("", 0, None):
            session["data"][k] = v

    # Save a snapshot of this turn in history
    session["history"].append({
        "turn": session["turn"],
        "timestamp": datetime.now().isoformat(),
        "new_data": new_data,
        "cumulative": dict(session["data"])
    })

    with open(_session_path(session_id), "w") as f:
        json.dump(session, f, indent=2)

    return session


def get_session_data(session_id: str) -> dict:
    """Return just the accumulated data dict from a session."""
    session = load_session(session_id)
    return session.get("data", {})
