from core.extractor import DOMAIN_REQUIRED_FIELDS

# Human-friendly question templates per field
FIELD_QUESTIONS = {
    # Finance
    "amount":           "Could you confirm the amount involved?",
    "date":             "When did this happen?",
    "issue":            "What seems to be the problem?",
    "transaction_type": "Was this a payment, transfer, or something else?",
    # Healthcare
    "symptoms":         "What symptoms are you experiencing?",
    "duration":         "How long have you had these symptoms?",
    "severity":         "How severe are the symptoms — mild, moderate, or severe?",
    "patient_name":     "May I know your name?",
    "existing_conditions": "Do you have any existing medical conditions?",
    # Ecommerce
    "order_id":         "Could you share the order ID?",
    "product":          "Which product is this about?",
    # General
    "summary":          "Could you briefly describe your concern?"
}


def decide_action(data: dict, domain: str = "general") -> dict:
    """
    Domain-aware controller.
    Checks required fields for the domain and returns:
    - { "action": "ask", "field": <field>, "question": <question> }
    - { "action": "final", "message": "All required data collected." }
    """
    required = DOMAIN_REQUIRED_FIELDS.get(domain, ["issue"])

    for field in required:
        value = data.get(field)
        # Consider field missing if empty string, zero, or None
        if value in ("", 0, None, []):
            question = FIELD_QUESTIONS.get(field, f"Can you provide the {field}?")
            return {
                "action": "ask",
                "field": field,
                "question": question
            }

    return {
        "action": "final",
        "message": "All required data has been collected.",
        "summary": data
    }
