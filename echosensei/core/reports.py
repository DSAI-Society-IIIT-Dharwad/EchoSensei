"""
DocuFlow — Report Persistence Layer
Manages structured clinical reports generated from doctor-patient conversations.
"""
import json
import os
import uuid
import glob
from datetime import datetime


REPORTS_DIR = "data/reports"


def _ensure_dir():
    os.makedirs(REPORTS_DIR, exist_ok=True)


def _report_path(report_id: str) -> str:
    return os.path.join(REPORTS_DIR, f"{report_id}.json")


def create_report(patient_info: dict, transcript: list, language: str = "English") -> str:
    """Create a new empty report shell and return its ID."""
    _ensure_dir()
    report_id = datetime.now().strftime("%Y%m%d") + "-" + str(uuid.uuid4())[:6]
    report = {
        "report_id": report_id,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "status": "draft",
        "language": language,
        "patient_info": patient_info,
        "transcript": transcript,
        "report_data": {
            "complaint": "",
            "background_history": "",
            "symptoms": "",
            "duration": "",
            "past_history": "",
            "clinical_observations": "",
            "diagnosis": "",
            "treatment_advice": "",
            "action_plan": "",
            "immunization_data": "",
            "pregnancy_data": "",
            "risk_indicators": "",
            "injury_mobility": "",
            "ent_findings": "",
            "verification_notes": "",
            "doctor_notes": ""
        }
    }
    with open(_report_path(report_id), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    return report_id


def save_report(report_id: str, data: dict):
    """Save/overwrite a full report object."""
    _ensure_dir()
    data["updated_at"] = datetime.now().isoformat()
    with open(_report_path(report_id), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_report(report_id: str) -> dict:
    """Load a report by ID. Returns empty dict if not found."""
    path = _report_path(report_id)
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_reports() -> list:
    """List all reports with summary metadata, newest first."""
    _ensure_dir()
    reports = []
    for filepath in glob.glob(os.path.join(REPORTS_DIR, "*.json")):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                rpt = json.load(f)
            patient = rpt.get("patient_info", {})
            reports.append({
                "report_id": rpt.get("report_id", ""),
                "created_at": rpt.get("created_at", ""),
                "status": rpt.get("status", "draft"),
                "language": rpt.get("language", "Unknown"),
                "patient_name": patient.get("name", "Unknown"),
                "patient_age": patient.get("age", ""),
                "patient_sex": patient.get("sex", ""),
                "complaint_preview": (rpt.get("report_data", {}).get("complaint", "") or "")[:80],
                "diagnosis_preview": (rpt.get("report_data", {}).get("diagnosis", "") or "")[:80],
                "transcript_turns": len(rpt.get("transcript", []))
            })
        except Exception:
            continue
    reports.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return reports


def delete_report(report_id: str) -> bool:
    """Delete a report. Returns True if deleted."""
    path = _report_path(report_id)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


def update_report_field(report_id: str, field: str, value) -> dict:
    """Update a single field in the report_data section. Returns updated report."""
    report = load_report(report_id)
    if not report:
        return {}
    if "report_data" not in report:
        report["report_data"] = {}
    report["report_data"][field] = value
    report["updated_at"] = datetime.now().isoformat()
    save_report(report_id, report)
    return report


def finalize_report(report_id: str) -> dict:
    """Mark a report as finalized (no longer draft)."""
    report = load_report(report_id)
    if not report:
        return {}
    report["status"] = "finalized"
    report["finalized_at"] = datetime.now().isoformat()
    save_report(report_id, report)
    return report
