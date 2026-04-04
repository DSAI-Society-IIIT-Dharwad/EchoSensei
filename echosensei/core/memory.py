import json
import os
import uuid
import glob
from datetime import datetime
from core.rag import rag_engine

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
        "language": "Unknown",
        "data": {},
        "history": []
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


def update_session(session_id: str, new_data: dict, domain: str = None, language: str = None, user_utterance: str = None, ai_response: str = None) -> dict:
    """
    Merge new extracted fields into the session.
    Skips empty/null values so earlier valid data isn't overwritten.
    Also indexes both the raw user utterance and extracted data into RAG.
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
            "language": language or "Unknown",
            "data": {},
            "history": []
        }

    session["turn"] += 1
    if domain:
        session["domain"] = domain
    if language:
        session["language"] = language

    # Merge: only overwrite if new value is non-empty
    for k, v in new_data.items():
        if v not in ("", 0, None):
            session["data"][k] = v

    # Save a snapshot of this turn in history
    session["history"].append({
        "turn": session["turn"],
        "timestamp": datetime.now().isoformat(),
        "new_data": new_data,
        "user_utterance": user_utterance,
        "ai_response": ai_response,
        "cumulative": dict(session["data"])
    })

    with open(_session_path(session_id), "w") as f:
        json.dump(session, f, indent=2)

    # ── RAG INDEXING ──
    timestamp = datetime.now().isoformat()

    # 1. Index the raw user utterance for richer semantic matching
    if user_utterance and len(user_utterance.strip()) >= 10:
        rag_engine.add_to_index(
            user_utterance,
            {
                "session_id": session_id,
                "type": "user_utterance",
                "domain": domain or "healthcare",
                "turn": session["turn"],
                "timestamp": timestamp
            }
        )

    # 2. Index the structured extracted data
    if new_data:
        data_summary = ", ".join([f"{k}: {v}" for k, v in new_data.items() if v])
        if data_summary:
            rag_engine.add_to_index(
                data_summary,
                {
                    "session_id": session_id,
                    "type": "extracted_data",
                    "domain": domain or "healthcare",
                    "turn": session["turn"],
                    "timestamp": timestamp
                }
            )

    return session


def get_session_data(session_id: str) -> dict:
    """Return just the accumulated data dict from a session."""
    session = load_session(session_id)
    return session.get("data", {})


def get_session_transcript(session_id: str) -> list:
    """Returns the verbatim dialog history: list of {user, sensei} dicts"""
    session = load_session(session_id)
    transcript = []
    for h in session.get("history", []):
        if h.get("user_utterance") or h.get("ai_response"):
            transcript.append({
                "user": h.get("user_utterance", ""),
                "sensei": h.get("ai_response", "")
            })
    return transcript


# ── NEW: List all sessions ────────────────────────────────────────────────────

def list_sessions() -> list:
    """Return a list of all sessions with metadata (sorted by newest first)."""
    _ensure_dir()
    sessions = []
    for filepath in glob.glob(os.path.join(SESSIONS_DIR, "*.json")):
        try:
            with open(filepath, "r") as f:
                sess = json.load(f)
            sessions.append({
                "session_id": sess.get("session_id", ""),
                "domain": sess.get("domain", "general"),
                "created_at": sess.get("created_at", ""),
                "turn": sess.get("turn", 0),
                "language": sess.get("language", "Unknown"),
                "data_preview": {k: str(v)[:50] for k, v in list(sess.get("data", {}).items())[:4]}
            })
        except Exception:
            continue
    sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return sessions


def delete_session(session_id: str) -> bool:
    """Delete a session file. Returns True if deleted."""
    path = _session_path(session_id)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


def edit_session_field(session_id: str, field: str, value) -> dict:
    """Edit a single field in a session's data. Returns updated session."""
    session = load_session(session_id)
    if not session:
        return {}
    session["data"][field] = value
    with open(_session_path(session_id), "w") as f:
        json.dump(session, f, indent=2)
    return session


def search_sessions(query: str) -> list:
    """Search across all session data for a text query."""
    _ensure_dir()
    results = []
    query_lower = query.lower()
    for filepath in glob.glob(os.path.join(SESSIONS_DIR, "*.json")):
        try:
            with open(filepath, "r") as f:
                sess = json.load(f)
            text_blob = json.dumps(sess).lower()
            if query_lower in text_blob:
                results.append({
                    "session_id": sess.get("session_id", ""),
                    "domain": sess.get("domain", "general"),
                    "created_at": sess.get("created_at", ""),
                    "turn": sess.get("turn", 0),
                    "language": sess.get("language", "Unknown"),
                    "data_preview": {k: str(v)[:50] for k, v in list(sess.get("data", {}).items())[:4]}
                })
        except Exception:
            continue
    return results


def get_analytics() -> dict:
    """Aggregate analytics across all sessions."""
    _ensure_dir()
    total = 0
    language_counts = {}
    total_turns = 0

    for filepath in glob.glob(os.path.join(SESSIONS_DIR, "*.json")):
        try:
            with open(filepath, "r") as f:
                sess = json.load(f)
            total += 1
            l = sess.get("language", "Unknown")
            language_counts[l] = language_counts.get(l, 0) + 1
            total_turns += sess.get("turn", 0)
        except Exception:
            continue

    return {
        "total_sessions": total,
        "total_turns": total_turns,
        "language_distribution": language_counts
    }


def reindex_all_sessions():
    """Wipe the RAG index and re-index all historical session data."""
    print("[RAG] 🔄 Re-indexing all historical sessions...")
    # Clear index file
    if os.path.exists(rag_engine.index_file):
        os.remove(rag_engine.index_file)
    rag_engine.index = []
    
    sessions_found = 0
    for filepath in glob.glob(os.path.join(SESSIONS_DIR, "*.json")):
        try:
            with open(filepath, "r") as f:
                sess = json.load(f)
            
            session_id = sess.get("session_id", "unknown")
            # Index current cumulative data
            data = sess.get("data", {})
            data_summary = ", ".join([f"{k}: {v}" for k, v in data.items() if v])
            if data_summary:
                rag_engine.add_to_index(
                    data_summary,
                    {"session_id": session_id, "type": "historical_data", "timestamp": sess.get("created_at")}
                )
            
            # Also index history turns if they contain unique info
            for turn in sess.get("history", []):
                new_data = turn.get("new_data", {})
                turn_summary = ", ".join([f"{k}: {v}" for k, v in new_data.items() if v])
                if turn_summary:
                    rag_engine.add_to_index(
                        turn_summary,
                        {"session_id": session_id, "type": "historical_turn", "timestamp": turn.get("timestamp")}
                    )
            sessions_found += 1
        except Exception as e:
            print(f"[RAG] ❌ Failed to re-index {filepath}: {e}")
            continue
    
    print(f"[RAG] ✅ Re-indexing complete. Indexed {sessions_found} sessions.")
