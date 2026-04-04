import json
import os
from datetime import datetime

TIMELINE_DIR = "data/timelines"

def _ensure_dir():
    os.makedirs(TIMELINE_DIR, exist_ok=True)

def _timeline_path(session_id: str) -> str:
    return os.path.join(TIMELINE_DIR, f"{session_id}_timeline.json")


def load_timeline(session_id: str) -> list:
    path = _timeline_path(session_id)
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)


def log_step(session_id: str, turn: int, event: str, detail: str = "", data: dict = None):
    """
    Logs one reasoning step for the session timeline.
    Args:
        session_id: current session ID
        turn: current conversation turn number
        event: short label e.g. "ASR Complete", "Domain Detected", "Entity Extracted"
        detail: longer description e.g. "Detected domain: finance"
        data: optional dict of extracted data at this step
    """
    _ensure_dir()
    timeline = load_timeline(session_id)

    step = {
        "turn": turn,
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "event": event,
        "detail": detail,
    }
    if data:
        step["data"] = data

    timeline.append(step)

    with open(_timeline_path(session_id), "w") as f:
        json.dump(timeline, f, indent=2)


def get_timeline(session_id: str) -> list:
    """Returns the full reasoning timeline for a session."""
    return load_timeline(session_id)


def print_timeline(session_id: str):
    """Pretty-prints the timeline to console."""
    timeline = load_timeline(session_id)
    print(f"\n📋 Reasoning Timeline — Session: {session_id}")
    print("─" * 55)
    for step in timeline:
        print(f"  [{step['timestamp']}] Turn {step['turn']} | {step['event']}")
        if step.get("detail"):
            print(f"             ↳ {step['detail']}")
        if step.get("data"):
            print(f"             📦 {step['data']}")
    print("─" * 55)
