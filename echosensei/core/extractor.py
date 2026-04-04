from models.llm import query_llm
from utils.parser import clean_json
import json

# Domain-specific required fields (shared with controller.py)
DOMAIN_REQUIRED_FIELDS = {
    "healthcare":  ["symptoms", "duration"]
}

# Domain-specific schemas
DOMAIN_SCHEMAS = {
    "healthcare": {
        "patient_name": "",
        "symptoms": "",
        "duration": "",
        "severity": "",
        "existing_conditions": "",
        "past_history": "",
        "clinical_observations": "",
        "diagnosis": "",
        "treatment_advice": "",
        "immunization_data": "",
        "pregnancy_data": "",
        "risk_indicators": "",
        "injury_mobility": "",
        "ent_findings": ""
    }
}

def extract_data(text: str, context: dict, forced_domain: str = None) -> dict:
    """
    Single LLM call: extracts structured healthcare data.
    Returns: { "domain": str, "data": dict }
    """
    all_schemas = json.dumps(DOMAIN_SCHEMAS["healthcare"], indent=2)

    prompt = f"""You are a strict JSON extractor for a medical AI system.

User Input: "{text}"

Previous Context: {json.dumps(context) if context else "None"}

Extract fields using the clinical medical schema:
{all_schemas}

Rules:
- Extract ONLY information explicitly present in the text.
- Do not infer a diagnosis unless the user explicitly mentions a doctor's diagnosis.
- Relative dates like "yesterday", "today", "kal" → include as-is in 'duration' or 'past_history' field.
- Return ONLY valid JSON. No explanation. No markdown.

Return format:
{{
  "domain": "healthcare",
  "data": {{ <fields matching the schema> }}
}}"""

    response = query_llm(prompt)
    cleaned = clean_json(response)

    if isinstance(cleaned, dict) and "domain" in cleaned and "data" in cleaned:
        return {"domain": "healthcare", "data": cleaned["data"]}

    # Fallback
    return {"domain": "healthcare", "data": {"symptoms": str(cleaned)}}
