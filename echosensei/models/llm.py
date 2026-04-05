import json
import os
import requests
from core.rag import rag_engine

OLLAMA_URL = "http://localhost:11434/api/generate"

def query_llm(prompt):
    """Query LLM via Groq API (cloud) or Ollama (local)."""
    groq_api_key = os.environ.get("GROQ_API_KEY")
    
    if groq_api_key:
        try:
            headers = {
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json"
            }
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "max_tokens": 1024
                },
                timeout=15
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[LLM] ❌ Groq API Error: {e}")
            return ""

    # Fallback to local Ollama
    try:
        response = requests.post(
            OLLAMA_URL,
            json={"model": "llama3", "prompt": prompt, "stream": False},
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")
    except requests.exceptions.ConnectionError:
        print("[LLM] ❌ Cannot connect to local Ollama. Is it running? Or provide a GROQ_API_KEY.")
        return ""
    except requests.exceptions.Timeout:
        print("[LLM] ❌ Ollama request timed out (120s).")
        return ""
    except Exception as e:
        print(f"[LLM] ❌ Error: {e}")
        return ""


def target_language_name(lang_code):
    """Maps code to language name for prompt injection."""
    mapping = {
        "hi": "Hindi", "ta": "Tamil", "kn": "Kannada", "en": "English"
    }
    return mapping.get(lang_code, "English")


def detect_language_mix(text):
    """Detect if the text contains mixed languages."""
    import re
    has_devanagari = bool(re.search(r'[\u0900-\u097F]', text))
    has_tamil = bool(re.search(r'[\u0B80-\u0BFF]', text))
    has_kannada = bool(re.search(r'[\u0C80-\u0CFF]', text))
    has_latin = bool(re.search(r'[a-zA-Z]{3,}', text))
    
    scripts_found = sum([has_devanagari, has_tamil, has_kannada, has_latin])
    
    if scripts_found > 1:
        return True, scripts_found
    return False, scripts_found


# ── DOMAIN PROMPT TEMPLATES ──────────────────────────────────────────────────

HEALTHCARE_PROMPT = """You are "Sensei", an intelligent, conversational medical AI assistant.
Your job is to act like a Medical Akinator: analyze symptoms, extract medical data, and ask follow-up questions to identify the disease.

EXTRACTION FIELDS (extract any that are mentioned):
- symptoms, duration, severity, existing_conditions, past_history
- clinical_observations, diagnosis, treatment_advice
- immunization_data, pregnancy_data, risk_indicators
- injury_mobility, ent_findings, patient_name

IMPORTANT: You must understand simple vocabulary outside of healthcare. If the user greets you or says something non-medical (like "hello" or "how are you" or "pardon me"), respond naturally and politely in conversational tone.

CRITICAL MEDICAL LOGIC: If a user states a medically impossible fact (e.g., "I am 20 months pregnant" or "my heart fell out"), DO NOT extract it. You must challenge it directly, explaining that it is medically impossible, and ask them to clarify accurately."""


def process_turn(native_text, language_name, session_history, session_transcript, domain="healthcare"):
    """
    Generalized multi-domain conversational turn processor.
    Handles: healthcare, finance, survey, general.
    """
    detected_lang_code = "en"
    lang_name_to_code = {
        "Hindi": "hi", "Tamil": "ta", "Kannada": "kn", 
        "English": "en", "Auto-Detect": "en"
    }
    # Notice language_name is now properly passed from ASR (which is auto-detected by Groq)
    detected_lang_code = lang_name_to_code.get(language_name, "en")
    target_lang = target_language_name(detected_lang_code)
    
    is_mixed, num_scripts = detect_language_mix(native_text)
    
    history_str = "None (This is the first message)"
    if session_history and len(session_history) > 0:
        history_str = json.dumps(session_history, indent=2)

    # --- RAG RETRIEVAL ---
    # Find relevant clinical data using semantic search
    rag_results = rag_engine.search(native_text, top_k=5, min_score=0.35)

    # Filter out results from the current session (those are already in history_str)
    session_id_hint = None
    if isinstance(session_history, dict):
        session_id_hint = session_history.get("session_id")

    filtered_rag = []
    for res in rag_results:
        src_session = res['metadata'].get('session_id', '')
        if session_id_hint and src_session == session_id_hint:
            continue
        filtered_rag.append(res)

    # Build concise RAG context (keep it short)
    rag_context = ""
    if filtered_rag:
        rag_snippets = []
        for res in filtered_rag[:3]:
            rag_snippets.append(res['text'][:150])
        rag_context = "Reference clinical knowledge: " + " | ".join(rag_snippets)

    transcript_str = "No prior questions asked."
    if session_transcript and len(session_transcript) > 0:
        transcript_str = ""
        for idx, t in enumerate(session_transcript):
            transcript_str += f"Turn {idx+1}:\nUser: {t['user']}\nSensei: {t['sensei']}\n\n"

    prompt = f"""{HEALTHCARE_PROMPT}

RULES:
1. Process the user's message in its ORIGINAL language. Do NOT fail if it is not in English.
2. Return ONLY valid JSON — no markdown, no explanation, no code fences.
3. CONVERSATIONAL MEMORY (CRITICAL): Read the `[Chat History]` below. You MUST ask a perfectly logical, completely NEW follow-up question that builds upon the user's latest response. NEVER repeat a question you already asked. DO NOT ask the user to describe something if they already gave you a description (e.g. if they say "sharp headache", DO NOT ask "describe the headache"). Move the diagnosis forward!
4. VITAL RULE: The `new_extracted_data` block is a medical database. To maintain universality, you MUST translate any extracted facts into ENGLISH before adding them. No non-English characters are allowed inside `new_extracted_data`.
5. For `sensei_question_english`, write your conversational medical response/question strictly in English entirely.
6. SENSEI NATIVE IDENTITY (CRITICAL): Your primary goal is to converse in the user's native language ({target_lang}). Even if you translate the `corrected_transcription` to English because it was code-mixed, your `sensei_question_native` MUST be in the perfect, professional script of the user's origin language ({target_lang}). Never respond in English script for the native field.
7. SEMANTIC UNDERSTANDING (FIRST PRINCIPLES): Do not just transliterate sounds. First, decode the EXACT medical meaning of the user's spoken words in their culture/context. Then, formulate your diagnosis. Finally, translate it into both English and the native script.
8. TRANSCRIPTION CORRECTION & HALLUCINATION PURGING: Look at the user's spoken text: "{native_text}". You MUST identify and quietly DELETE any hallucinatory words (e.g., random background noise phrases). After cleaning: Output the `corrected_transcription`. You MUST be medically literal. Do NOT hallucinate new symptoms. If the user said "headache," your translation MUST be "headache"—never "fever." If the user spoke purely in a single language, output that native language. IF the user mixed multiple languages (e.g. Tamil + English loan words), translate their entire sentence into pure English for the `corrected_transcription` logs.
9. COMPREHENSIVE RESPONSE: You must address ALL parts of the user's message. Do not ignore secondary symptoms, multiple questions, or side-comments. Address everything they mentioned.

{rag_context}

[Current Database Records]: 
{history_str}

[Chat History]:
{transcript_str}

User says: "{native_text}"
Detected Audio Language: {target_lang}

RESPOND with this exact JSON structure:
{{
  "corrected_transcription": "<The user's original speech but with English loanwords properly written in English alphabet>",
  "new_extracted_data": {{}},
  "sensei_question_english": "<follow-up question or conversational response IN ENGLISH>",
  "sensei_question_native": "<SAME question translated to {target_lang}>",
  "requires_doctor_supervision": false,
  "differential_diagnoses": [
    {{
      "disease": "Disease Name",
      "probability": "85%",
      "reasoning": "Why you think so based on symptoms"
    }}
  ]
}}"""

    try:
        response = query_llm(prompt)
        from utils.parser import clean_json
        parsed = clean_json(response)
        if isinstance(parsed, dict):
            # Normalise variables for frontend compatibility
            # Always prefer English if target is English, otherwise use native
            if target_lang == "English":
                parsed["sensei_question"] = parsed.get("sensei_question_english", "Can you tell me more?")
            else:
                parsed["sensei_question"] = parsed.get("sensei_question_native", parsed.get("sensei_question_english", "Can you tell me more?"))
            parsed["response_language"] = target_lang
            # Attach RAG context metadata for the frontend
            parsed["_rag_context"] = [
                {"text": r["text"][:100], "score": r["score"], "session": r["metadata"].get("session_id", r["metadata"].get("source", "knowledge_base"))}
                for r in filtered_rag[:3]
            ]
            return parsed
        print(f"❌ LLM failed to output JSON: {response}")
        raise ValueError("Invalid JSON output")
    except Exception as e:
        print(f"❌ Error in process_turn: {e}")
        return {
            "new_extracted_data": {},
            "sensei_question": "I'm having trouble processing that. Could you please repeat what you said?",
            "sensei_question_english": "I'm having trouble processing that. Could you please repeat what you said?",
            "requires_doctor_supervision": False,
            "differential_diagnoses": [{"disease": "Unknown", "probability": "0%", "reasoning": "Unable to process"}],
            "response_language": target_lang,
            "_rag_context": []
        }


# Backward compatibility alias
def process_medical_turn(native_text, language_name, session_history, session_transcript=None):
    return process_turn(native_text, language_name, session_history, session_transcript or [], domain="healthcare")