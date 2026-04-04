from models.llm import query_llm
from utils.parser import clean_json
import json

# Domain-specific required fields (shared with controller.py)
DOMAIN_REQUIRED_FIELDS = {
    "healthcare":  ["symptoms", "duration"],
    "finance":     ["amount", "issue"],
    "ecommerce":   ["order_id", "issue"],
    "general":     ["issue"]
}

# Domain-specific schemas
DOMAIN_SCHEMAS = {
    "healthcare": {
        "patient_name": "",
        "symptoms": "",
        "duration": "",
        "severity": "",
        "existing_conditions": ""
    },
    "finance": {
        "amount": 0,
        "date": "",
        "issue": "",
        "transaction_type": ""
    },
    "ecommerce": {
        "order_id": "",
        "amount": 0,
        "product": "",
        "issue": ""
    },
    "general": {
        "summary": "",
        "issue": ""
    }
}

# Strong domain hint keywords — helps LLM classify better
DOMAIN_HINTS = {
    "finance":    ["paid", "payment", "amount", "rupees", "loan", "account", "transaction",
                   "bank", "money", "transfer", "balance", "updated", "debit", "credit",
                   "hazaar", "lakh", "paisa", "rupaya", "5000", "paise"],
    "healthcare": ["fever", "pain", "doctor", "symptom", "medicine", "ill", "sick",
                   "headache", "cough", "cold", "disease", "hospital", "patient"],
    "ecommerce":  ["order", "product", "delivery", "refund", "return", "item",
                   "shipping", "package", "amazon", "flipkart"]
}


def _hint_domain(text: str) -> str | None:
    """
    Quick keyword-based domain pre-detection.
    Returns a domain string if confident, else None (let LLM decide).
    """
    lower = text.lower()
    scores = {domain: 0 for domain in DOMAIN_HINTS}
    for domain, keywords in DOMAIN_HINTS.items():
        scores[domain] = sum(1 for kw in keywords if kw in lower)
    best = max(scores, key=scores.get)
    return best if scores[best] >= 1 else None


def extract_data(text: str, context: dict) -> dict:
    """
    Single LLM call: detects domain + extracts structured data together.
    Uses keyword pre-detection to hint the LLM toward the right domain.
    Returns: { "domain": str, "data": dict }
    """
    # Pre-detect domain from keywords to guide the LLM
    hint = _hint_domain(text)
    hint_instruction = (
        f"IMPORTANT: Based on keywords in the text, this is most likely a '{hint}' conversation. "
        f"Use the '{hint}' schema unless the text clearly indicates otherwise."
        if hint else ""
    )

    all_schemas = json.dumps(DOMAIN_SCHEMAS, indent=2)

    prompt = f"""You are a strict JSON extractor for a multilingual voice AI system.

User Input: "{text}"

Previous Context: {json.dumps(context) if context else "None"}

{hint_instruction}

Step 1 — Identify the domain from: healthcare, finance, ecommerce, general.

Step 2 — Extract fields using the schema for that domain:
{all_schemas}

Rules:
- Use ONLY the schema matching the detected domain.
- Extract ONLY information explicitly present in the text.
- DO NOT leave 'issue' empty if the user describes a problem (e.g. "not updated", "pending", "not reflected").
- Indirect problem phrases MUST be mapped to 'issue':
    "not updated" → issue: "payment not updated"
    "still pending" → issue: "still pending"
    "not reflected" → issue: "transaction not reflected"
- Relative dates like "yesterday", "today", "kal" → include as-is in date field.
- Numbers in any form → extract to amount field (e.g. "5000", "five thousand", "paanch hazaar" → 5000).
- Return ONLY valid JSON. No explanation. No markdown.

Return format:
{{
  "domain": "<detected domain>",
  "data": {{ <fields matching that domain schema> }}
}}"""

    response = query_llm(prompt)
    cleaned = clean_json(response)

    if isinstance(cleaned, dict) and "domain" in cleaned and "data" in cleaned:
        domain = cleaned["domain"]
        if domain not in DOMAIN_SCHEMAS:
            domain = hint or "general"
        return {"domain": domain, "data": cleaned["data"]}

    # Fallback: use hinted domain with raw summary
    fallback_domain = hint or "general"
    return {"domain": fallback_domain, "data": {"issue": str(cleaned), "summary": text}}
