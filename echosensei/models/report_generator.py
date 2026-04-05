"""
DocuFlow — Clinical Report Generator
Step 1: Takes raw transcript text and classifies speaker turns (Doctor / Patient)
Step 2: Converts the classified conversation into a structured hospital report
Both steps use the Groq LLM API. The final output is a formal medical document, NOT a dialogue.
"""
import json
import os
import re
import requests


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _ensure_strings(d: dict) -> dict:
    """
    Recursively ensure all values in the report dict are plain strings.
    Converts arrays to comma-separated strings and nested objects to readable text.
    This prevents [object Object] rendering in the frontend.
    """
    result = {}
    for k, v in d.items():
        if isinstance(v, list):
            # Join array items into a single string
            items = []
            for item in v:
                if isinstance(item, dict):
                    items.append(', '.join(f"{ik}: {iv}" for ik, iv in item.items()))
                else:
                    items.append(str(item))
            result[k] = ', '.join(items)
        elif isinstance(v, dict):
            result[k] = '; '.join(f"{ik}: {iv}" for ik, iv in v.items())
        elif v is None:
            result[k] = 'N/A'
        else:
            result[k] = str(v)
    return result


def _groq_call(api_key: str, prompt: str, temperature: float = 0, timeout: int = 60) -> str:
    """Make a single groq LLM call and return raw text response."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    response = requests.post(
        GROQ_URL,
        headers=headers,
        json={
            "model": "llama-3.1-8b-instant",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature
        },
        timeout=timeout
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def classify_speakers(raw_transcript: str, language: str = "auto") -> list:
    """
    Step 1: Take a raw, unsegmented transcript and classify each sentence
    as spoken by either 'Doctor' or 'Patient'.

    Returns a list of dicts: [{"speaker": "Doctor"/"Patient", "text": "..."}]
    """
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        # Fallback: return whole transcript as a single turn
        return [{"speaker": "Unknown", "text": raw_transcript}]

    prompt = f"""You are a conversation analyst AI specializing in medical consultations. Below is a raw transcript of a medical consultation between a doctor and a patient. The conversation may be in ANY language including English, Tamil (தமிழ்), Hindi (हिंदी), Kannada (ಕನ್ನಡ), or code-mixed multilingual speech.

Your task is to split this transcript into individual turns and classify each turn as either "Doctor" or "Patient".

RULES:
1. Identify speaker changes based on CONTEXT CLUES in any language:
   - Doctor typically: asks about symptoms (என்ன பிரச்சனை / क्या प्रॉब्लम है / ಏನು ತೊಂದರೆ), gives diagnoses, prescribes medications (மருந்து / दवाई / ಔಷಧ), recommends tests
   - Patient typically: describes complaints (வலி / दर्द / ನೋವು), answers questions, provides history
2. If the first speaker asks health-related questions, that is the Doctor.
3. Each turn should be a natural utterance (1-3 sentences). Don't merge everything into one turn.
4. PRESERVE the original language of the speech — do NOT translate.
5. Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
6. For Tamil text, keep it in Tamil script (தமிழ்). For Hindi, keep in Devanagari (देवनागरी). For Kannada, keep in Kannada script (ಕನ್ನಡ).

RAW TRANSCRIPT:
{raw_transcript}

Return format (JSON array only):
[
  {{"speaker": "Doctor", "text": "..."}},
  {{"speaker": "Patient", "text": "..."}},
  ...
]"""

    try:
        raw = _groq_call(groq_api_key, prompt)
        from utils.parser import clean_json
        # The parser expects a dict but we have an array, handle both
        raw_cleaned = raw.strip()
        # Remove markdown fences if present
        import re
        raw_cleaned = re.sub(r"```json|```", "", raw_cleaned).strip()
        parsed = json.loads(raw_cleaned)
        if isinstance(parsed, list) and len(parsed) > 0:
            print(f"[DocuFlow] ✅ Speaker classification: {len(parsed)} turns identified")
            return parsed
        else:
            print(f"[DocuFlow] ⚠️ Speaker classification returned unexpected format, falling back")
            return [{"speaker": "Unknown", "text": raw_transcript}]
    except Exception as e:
        print(f"[DocuFlow] ❌ Speaker classification error: {e}")
        return [{"speaker": "Unknown", "text": raw_transcript}]


def generate_clinical_report(transcript: list, patient_info: dict, language: str = "English") -> dict:
    """
    Step 2: Analyze a classified conversation transcript and generate a structured clinical report.

    Args:
        transcript: List of dicts with 'speaker' and 'text' keys (from classify_speakers)
        patient_info: Dict with patient registration data (name, age, sex, etc.)
        language: The primary language of the conversation

    Returns:
        Dict with all report sections filled in (English), or error dict on failure.
    """
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        return {"error": "GROQ_API_KEY not set. Cannot generate report."}

    # Build the conversation text
    conversation_text = ""
    for turn in transcript:
        speaker = turn.get("speaker", "Unknown")
        text = turn.get("text", "")
        conversation_text += f"{speaker}: {text}\n"

    # Build patient summary
    patient_summary = ", ".join([
        f"{k}: {v}" for k, v in patient_info.items() if v
    ]) or "No patient details provided."

    prompt = f"""You are a clinical documentation AI assistant. Your task is to analyze the following doctor-patient conversation transcript and generate a structured clinical report for hospital records.

CRITICAL RULES:
1. The output must be a STRUCTURED MEDICAL REPORT — NOT a dialogue transcript.
2. Extract and organize all relevant medical information from the conversation.
3. Write in clear, professional medical English regardless of the conversation's language.
4. If a section has no relevant data from the conversation, write "N/A".
5. Return ONLY valid JSON — no markdown, no explanation, no code fences.
6. EVERY value in the JSON MUST be a plain STRING. Do NOT use arrays or nested objects. If listing multiple items, join them with commas in a single string.
7. For symptoms, list each symptom in a single comma-separated string.
8. For diagnosis, include differential diagnoses if discussed, as a single string.
9. Translate any non-English content (Tamil, Hindi, Kannada) to English for the report.

PATIENT INFORMATION:
{patient_summary}

CONVERSATION TRANSCRIPT:
{conversation_text}

Generate the report as this exact JSON structure:
{{
    "complaint": "<Primary complaint or reason for visit>",
    "symptoms": "<All symptoms mentioned, listed clearly>",
    "duration": "<Duration/timeline of symptoms>",
    "background_history": "<Patient's background medical history, family history, lifestyle>",
    "past_history": "<Previous illnesses, surgeries, hospitalizations>",
    "clinical_observations": "<Doctor's observations, examination findings, vitals if mentioned>",
    "diagnosis": "<Diagnosis or differential diagnoses with reasoning>",
    "treatment_advice": "<Medications prescribed, dosages, instructions>",
    "action_plan": "<Follow-up plan, tests ordered, referrals, next steps>",
    "immunization_data": "<Any vaccination/immunization information discussed>",
    "pregnancy_data": "<Pregnancy-related data if applicable, otherwise N/A>",
    "risk_indicators": "<Risk factors identified: lifestyle, hereditary, environmental>",
    "injury_mobility": "<Injury details, mobility assessment, physical limitations>",
    "ent_findings": "<ENT (Ear, Nose, Throat) specific findings if applicable>",
    "verification_notes": "<Any confirmations, clarifications, survey responses from the patient>",
    "doctor_notes": "<Additional notes, observations, or remarks by the doctor>"
}}"""

    try:
        raw = _groq_call(groq_api_key, prompt, timeout=60)

        # Parse the JSON response
        from utils.parser import clean_json
        parsed = clean_json(raw)
        if isinstance(parsed, dict) and not parsed.get("error"):
            # Ensure all values are plain strings (fix [object Object] bug)
            parsed = _ensure_strings(parsed)
            print(f"[DocuFlow] ✅ Clinical report generated successfully ({len(parsed)} sections)")
            return parsed
        else:
            print(f"[DocuFlow] ❌ LLM returned non-JSON: {raw[:200]}")
            return {"error": "Failed to parse LLM response into structured report."}

    except Exception as e:
        print(f"[DocuFlow] ❌ Report generation error: {e}")
        return {"error": str(e)}


def process_full_session(raw_transcript: str, patient_info: dict, language: str = "English") -> dict:
    """
    Complete pipeline: classify speakers → generate report.
    Returns dict with 'transcript' (classified) and 'report_data' (structured report).
    """
    print(f"[DocuFlow] 🔄 Processing full session ({len(raw_transcript)} chars)...")

    # Step 1: Classify speakers
    classified_transcript = classify_speakers(raw_transcript, language)

    # Step 2: Generate report
    report_data = generate_clinical_report(classified_transcript, patient_info, language)

    return {
        "transcript": classified_transcript,
        "report_data": report_data
    }
