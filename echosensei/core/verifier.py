import re
from models.llm import query_llm

# ── Hindi number-word to integer converter ────────────────────────────────────

HINDI_ONES = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5, "chhe": 6,
    "saat": 7, "aath": 8, "nau": 9, "das": 10, "gyarah": 11, "barah": 12,
    "terah": 13, "chaudah": 14, "pandrah": 15, "solah": 16, "satrah": 17,
    "atharah": 18, "unees": 19, "bees": 20, "tees": 30, "chaalees": 40,
    "pachaas": 50, "saath": 60, "sattar": 70, "assi": 80, "nabbe": 90
}

HINDI_MULTIPLIERS = {
    "hazaar": 1_000,
    "hazar":  1_000,
    "lakh":   1_00_000,
    "lac":    1_00_000,
    "crore":  1_00_00_000,
    "karod":  1_00_00_000
}


def parse_hindi_number(text: str) -> int | None:
    """
    Parses Hindi/Hinglish number expressions to integer.
    Examples:
        "paanch hazaar"  → 5000
        "do lakh"        → 200000
        "teen hazaar"    → 3000
    Returns None if no match found.
    """
    text = text.lower().strip()
    total = 0
    found = False

    for ones_word, ones_val in HINDI_ONES.items():
        for mult_word, mult_val in HINDI_MULTIPLIERS.items():
            pattern = rf"\b{ones_word}\s+{mult_word}\b"
            if re.search(pattern, text):
                total += ones_val * mult_val
                found = True

    # Single multiplier without ones (e.g. "ek hazaar" already caught, but also plain "hazaar")
    for mult_word, mult_val in HINDI_MULTIPLIERS.items():
        if re.search(rf"\b{mult_word}\b", text) and not found:
            total += mult_val
            found = True

    return total if found else None


# ── Self-Verification Module ──────────────────────────────────────────────────

def verify_amount(raw_text: str, extracted_amount) -> dict:
    """
    Checks if the extracted amount matches what was said.
    Uses Hindi number parser first, falls back to LLM.
    Returns: { "verified": bool, "expected": int|None, "extracted": any, "question": str|None }
    """
    parsed = parse_hindi_number(raw_text)

    if parsed is not None:
        try:
            extracted_int = int(str(extracted_amount).replace(",", "").replace("₹", "").strip())
        except (ValueError, TypeError):
            extracted_int = None

        if extracted_int is not None and parsed != extracted_int:
            return {
                "verified": False,
                "expected": parsed,
                "extracted": extracted_amount,
                "question": f"Just to confirm — did you say ₹{parsed:,} or ₹{extracted_int:,}?"
            }

    return {"verified": True, "expected": parsed, "extracted": extracted_amount, "question": None}


def verify_with_llm(original_text: str, extracted_data: dict) -> dict:
    """
    Uses LLM to cross-check extracted data against the original utterance.
    Returns: { "ok": bool, "issues": list[str], "followup_question": str|None }
    """
    import json

    prompt = f"""You are a verification agent for a voice AI system.

Original user utterance: "{original_text}"

Extracted data: {json.dumps(extracted_data)}

Your job:
1. Check if the extracted data accurately reflects what the user said.
2. Look for any mismatch — wrong amounts, wrong dates, missing key info.
3. If everything looks correct, say OK.
4. If there's a mismatch or ambiguity, write a short clarifying question to ask the user.

Return ONLY a JSON object like this:
{{
  "ok": true or false,
  "issues": ["describe any mismatch here, or empty list if none"],
  "followup_question": "question to ask user, or null if none needed"
}}

No explanation. No markdown. Only JSON."""

    from utils.parser import clean_json
    response = query_llm(prompt)
    result = clean_json(response)

    if isinstance(result, dict) and "ok" in result:
        return result

    return {"ok": True, "issues": [], "followup_question": None}


def run_verification(original_text: str, extracted_data: dict) -> dict:
    """
    Master verification function. Runs:
    1. Numeric amount check (fast, rule-based)
    2. LLM cross-check
    Returns combined result with any follow-up question.
    """
    result = {
        "passed": True,
        "followup_question": None,
        "details": []
    }

    # Step 1: Amount check
    amount = extracted_data.get("amount")
    if amount:
        amt_check = verify_amount(original_text, amount)
        if not amt_check["verified"]:
            result["passed"] = False
            result["followup_question"] = amt_check["question"]
            result["details"].append(f"Amount mismatch: said {amt_check['expected']}, extracted {amt_check['extracted']}")
            return result  # No need to call LLM if already flagged

    # Step 2: LLM verification
    llm_check = verify_with_llm(original_text, extracted_data)
    if not llm_check.get("ok", True):
        result["passed"] = False
        result["followup_question"] = llm_check.get("followup_question")
        result["details"].extend(llm_check.get("issues", []))

    return result
