import requests

OLLAMA_URL = "http://localhost:11434/api/generate"

def query_llm(prompt):
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            },
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")
    except requests.exceptions.ConnectionError:
        print("[LLM] ❌ Cannot connect to Ollama. Is it running?")
        return ""
    except requests.exceptions.Timeout:
        print("[LLM] ❌ Ollama request timed out (120s).")
        return ""
    except Exception as e:
        print(f"[LLM] ❌ Error: {e}")
        return ""


# 🔥 Translation function
def translate_to_english(text):
    prompt = f"""
Translate the following text to English.

Text: "{text}"

Return ONLY the translated sentence.
Do NOT add explanations.
"""
    response = query_llm(prompt)

    # Clean extra text
    return response.replace("Here is the translation:", "").strip().replace('"', '')

# 🔥 Single-Pass Medical Processing (Extraction + Akinator + Memory + Language)
def process_medical_turn(native_text, language_name, session_history):
    import json
    
    # Format the history for the LLM
    history_str = "None (This is the first message)"
    if session_history and len(session_history) > 0:
        history_str = json.dumps(session_history, indent=2)

    prompt = f"""
You are "Sensei", an intelligent, conversational medical AI assistant.
Your job is to act like a Medical Akinator: analyze symptoms, extract medical data, and ask follow-up questions to identify the disease.

Target Language: {language_name}
(You MUST translate your 'sensei_question' into {language_name}. If {language_name} is 'Auto-Detect' or 'English', use English. If it is mixed Hindi/English, respond in a natural conversational mix matching the user).

--- CONVERSATION CONTEXT ---
Previous Extracted Data & History:
{history_str}

Current User Message: "{native_text}"
---

TASK:
1. Extract any NEW medical entities from the current user message (e.g., symptoms, duration, severity, existing_conditions). If no new entities, return an empty object for 'new_extracted_data'.
2. Act as the Akinator: Based on the total history + new message, ask ONE logical, conversational follow-up question directly to the patient to narrow down the diagnosis.
3. Determine if doctor supervision is currently necessary (true/false).
4. Determine your best diagnosis guess so far.

Return exactly and ONLY valid JSON in this format:
{{
  "new_extracted_data": {{
    "symptoms": "...",
    "duration": "...",
    "severity": "...",
    "existing_conditions": "..."
  }},
  "sensei_question": "<your conversational follow-up question IN {language_name}>",
  "requires_doctor_supervision": <true or false>,
  "current_diagnosis_guess": "<guess in English>"
}}
"""
    try:
        response = query_llm(prompt)
        from utils.parser import clean_json
        parsed = clean_json(response)
        if isinstance(parsed, dict):
            return parsed
        print(f"❌ LLM failed to output JSON: {response}")
        raise ValueError("Invalid JSON output")
    except Exception as e:
        print(f"❌ Error in process_medical_turn: {e}")
        return {
            "new_extracted_data": {},
            "sensei_question": "I'm having trouble connecting right now. Could you please repeat that?",
            "requires_doctor_supervision": False,
            "current_diagnosis_guess": "Unknown"
        }
