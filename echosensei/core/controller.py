from core.extractor import DOMAIN_REQUIRED_FIELDS

# Human-friendly question templates per field — Healthcare only
FIELD_QUESTIONS = {
    "symptoms":              "What symptoms are you experiencing?",
    "duration":              "How long have you had these symptoms?",
    "severity":              "How severe are the symptoms — mild, moderate, or severe?",
    "patient_name":          "May I know your name?",
    "existing_conditions":   "Do you have any existing medical conditions?",
    "past_history":          "Can you tell me about your past medical history?",
    "clinical_observations": "Are there any clinical observations to note?",
    "diagnosis":             "Has any diagnosis been made so far?",
    "treatment_advice":      "What treatment has been advised or taken?",
    "immunization_data":     "Is your immunization history up to date?",
    "pregnancy_data":        "Any pregnancy-related information to share?",
    "risk_indicators":       "Are there any known risk factors?",
    "injury_mobility":       "Can you describe any injury or mobility concerns?",
    "ent_findings":          "Any ear, nose, or throat related findings?"
}

# Priority order for fields
DOMAIN_FIELD_PRIORITY = {
    "healthcare":  ["patient_name", "symptoms", "duration", "severity", "existing_conditions",
                    "past_history", "clinical_observations", "diagnosis", "treatment_advice",
                    "risk_indicators", "injury_mobility", "ent_findings",
                    "immunization_data", "pregnancy_data"]
}


def decide_action(data: dict, domain: str = "healthcare") -> dict:
    """
    Healthcare controller.
    Checks required clinical fields and returns:
    - { "action": "ask", "field": <field>, "question": <question> }
    - { "action": "final", "message": "All required data collected." }
    """
    required = DOMAIN_REQUIRED_FIELDS.get("healthcare", ["symptoms"])

    for field in required:
        value = data.get(field)
        if value in ("", 0, None, []):
            question = FIELD_QUESTIONS.get(field, f"Can you provide your {field}?")
            return {
                "action": "ask",
                "field": field,
                "question": question
            }

    return {
        "action": "final",
        "message": "All required clinical data has been collected.",
        "summary": data
    }


def get_next_question(data: dict, domain: str = "healthcare") -> dict | None:
    """
    Returns the next unanswered clinical field based on priority order.
    Returns None if all priority fields are filled.
    """
    priority = DOMAIN_FIELD_PRIORITY.get("healthcare", ["symptoms"])

    for field in priority:
        value = data.get(field)
        if value in ("", 0, None, []):
            question = FIELD_QUESTIONS.get(field, f"Can you provide your {field}?")
            return {"field": field, "question": question}

    return None
