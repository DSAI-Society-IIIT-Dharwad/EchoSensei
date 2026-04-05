import os
import sys
import logging
from flask import Flask, send_from_directory, request, jsonify
from werkzeug.utils import secure_filename

from flask_cors import CORS

try:
    from models.asr import transcribe
    from models.llm import process_turn
    from core.memory import (
        update_session, get_session_data, get_session_transcript, new_session, load_session,
        list_sessions, delete_session, edit_session_field,
        search_sessions, get_analytics, reindex_all_sessions
    )
    from core.timeline import get_timeline
    from core.rag import rag_engine
    from models.report_generator import generate_clinical_report, classify_speakers, process_full_session
    from core.reports import (
        create_report, save_report as persist_report, load_report, list_reports,
        delete_report as remove_report, update_report_field, finalize_report
    )
except ImportError as e:
    logging.error(f"Failed to load models. Error: {e}")

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

UPLOAD_FOLDER = os.path.join(os.environ.get('TEMP', '/tmp'), 'echosensei_audio')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)


# ── MAIN VOICE PIPELINE ──────────────────────────────────────────────────────

@app.route('/api/transcribe_and_analyze', methods=['POST'])
def transcribe_and_analyze():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    filename = secure_filename(audio_file.filename)
    if not filename:
        filename = "recording.webm"
        
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(filepath)

    try:
        target_lang = request.form.get('language', 'auto')
        session_id = request.form.get('session_id', 'default_session')
        domain = request.form.get('domain', 'healthcare')

        print(f"🎙️ Transcribing {filepath} in '{target_lang}'...")
        asr_result = transcribe(filepath, target_lang=target_lang)
        native_text = asr_result["text"]
        lang_name = asr_result["lang_name"]

        # SILENCE BARRIER: If audio is uninterpretable, don't reset. Ask for repeat.
        if not native_text or len(native_text.strip()) < 1:
            print("   [ASR] 🔇 Silence/Noise detected. Bypassing LLM with pardon message.")
            pardon_native = "மன்னிக்கவும், எனக்கு சரியாக கேட்கவில்லை. மீண்டும் சொல்ல முடியுமா?"
            if lang_name == "Hindi": pardon_native = "क्षमा करें, मुझे सुनाई नहीं दिया। क्या आप फिर से बोल सकते हैं?"
            if lang_name == "Kannada": pardon_native = "ಕ್ಷಮಿಸಿ, ನನಗೆ ಸರಿಯಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪುನರಾವರ್ತಿಸಿ."
            
            return jsonify({
                "success": True,
                "transcription": {"text": "(Silence detected)"},
                "analysis": {"domain": domain, "data": get_session_data(session_id)},
                "akinator": {
                    "sensei_question_english": "I didn't quite catch that. Could you please repeat?",
                    "sensei_question_native": pardon_native,
                    "differential_diagnoses": []
                }
            })

        session_data = get_session_data(session_id)
        session_transcript = get_session_transcript(session_id)

        print(f"🤖 Processing turn for domain: {domain}, language: {lang_name}")
        llm_response = process_turn(native_text, lang_name, session_data, session_transcript, domain=domain)

        new_data = llm_response.get("new_extracted_data", {})
        ai_ans = llm_response.get("sensei_question", "")
        corrected_text = llm_response.get("corrected_transcription")
        
        # Overwrite raw ASR text with LLM's cleaned code-mixed text if generated
        if corrected_text and len(corrected_text.strip()) > 0:
            asr_result["text"] = corrected_text
            native_text = corrected_text # Save the clean text to memory
            print(f"✨ LLM Auto-Corrected Transcription: {native_text}")

        if new_data or ai_ans:
            update_session(session_id, new_data, domain=domain, language=lang_name, user_utterance=native_text, ai_response=ai_ans)
        
        updated_session = get_session_data(session_id)

        # Include RAG context info in the response
        rag_context_used = llm_response.get("_rag_context", [])

        return jsonify({
            "success": True,
            "transcription": asr_result,
            "analysis": {"domain": domain, "data": updated_session},
            "akinator": llm_response,
            "rag_context": rag_context_used
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Error during processing: {e}")
        return jsonify({"error": str(e)}), 500


# ── TEXT INPUT PIPELINE ──────────────────────────────────────────────────────

@app.route('/api/text_input', methods=['POST'])
def text_input():
    """Process text input instead of audio — same pipeline minus ASR."""
    data = request.get_json()
    if not data or not data.get('text'):
        return jsonify({"error": "No text provided"}), 400

    text = data['text']
    session_id = data.get('session_id', 'default_session')
    domain = data.get('domain', 'healthcare')
    language = data.get('language', 'English')

    try:
        session_data = get_session_data(session_id)
        session_transcript = get_session_transcript(session_id)
        
        print(f"📝 Text input: '{text[:80]}...' | Domain: {domain}")
        llm_response = process_turn(text, language, session_data, session_transcript, domain=domain)

        new_data = llm_response.get("new_extracted_data", {})
        ai_ans = llm_response.get("sensei_question", "")
        if new_data or ai_ans:
            update_session(session_id, new_data, domain=domain, language=language, user_utterance=text, ai_response=ai_ans)
        
        updated_session = get_session_data(session_id)

        # Include RAG context info in the response
        rag_context_used = llm_response.get("_rag_context", [])

        return jsonify({
            "success": True,
            "transcription": {
                "text": text,
                "detected_lang": "en",
                "lang_name": language,
                "was_translated": False,
                "latency_ms": 0
            },
            "analysis": {"domain": domain, "data": updated_session},
            "akinator": llm_response,
            "rag_context": rag_context_used
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── SESSION MANAGEMENT ────────────────────────────────────────────────────────

@app.route('/api/session/new', methods=['POST'])
def create_session():
    """Create a new session."""
    data = request.get_json() or {}
    domain = data.get('domain', 'healthcare')
    session_id = new_session(domain=domain)
    return jsonify({"session_id": session_id, "domain": domain})


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """List all sessions."""
    query = request.args.get('q', '')
    if query:
        sessions = search_sessions(query)
    else:
        sessions = list_sessions()
    return jsonify({"sessions": sessions})


@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get full session data."""
    session = load_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(session)


@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def remove_session(session_id):
    """Delete a session."""
    if delete_session(session_id):
        return jsonify({"success": True})
    return jsonify({"error": "Session not found"}), 404


@app.route('/api/sessions/<session_id>/data', methods=['PUT'])
def edit_session_data(session_id):
    """Edit a field in session data (for editable review interface)."""
    data = request.get_json()
    if not data or 'field' not in data or 'value' not in data:
        return jsonify({"error": "Missing field or value"}), 400
    
    updated = edit_session_field(session_id, data['field'], data['value'])
    if not updated:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"success": True, "data": updated.get("data", {})})


@app.route('/api/sessions/<session_id>/timeline', methods=['GET'])
def get_session_timeline(session_id):
    """Get reasoning timeline for a session."""
    timeline = get_timeline(session_id)
    return jsonify({"timeline": timeline})


# ── ANALYTICS ─────────────────────────────────────────────────────────────────

@app.route('/api/analytics', methods=['GET'])
def analytics():
    """Dashboard analytics."""
    stats = get_analytics()
    return jsonify(stats)


# ── RAG ENDPOINTS ─────────────────────────────────────────────────────────────

@app.route('/api/rag/status', methods=['GET'])
def rag_status():
    """Return RAG engine statistics: index size, model status, chunk types."""
    stats = rag_engine.get_stats()
    return jsonify(stats)


@app.route('/api/rag/search', methods=['POST'])
def rag_search():
    """Manual semantic search against the RAG index."""
    data = request.get_json()
    if not data or not data.get('query'):
        return jsonify({"error": "No query provided"}), 400
    query = data['query']
    top_k = data.get('top_k', 5)
    min_score = data.get('min_score', 0.3)
    results = rag_engine.search(query, top_k=top_k, min_score=min_score)
    return jsonify({"query": query, "results": results, "total": len(results)})


@app.route('/api/rag/reindex', methods=['POST'])
def rag_reindex():
    """Wipe and rebuild the RAG index from all stored sessions."""
    reindex_all_sessions()
    stats = rag_engine.get_stats()
    return jsonify({"success": True, "stats": stats})


@app.route('/api/rag/clear', methods=['POST'])
def rag_clear():
    """Clear the entire RAG index."""
    rag_engine.clear_index()
    return jsonify({"success": True, "message": "RAG index cleared."})


# ══════════════════════════════════════════════════════════════════════════════
# ══  DOCUFLOW — SPEECH-DRIVEN DOCUMENTATION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/docuflow/transcribe_full', methods=['POST'])
def docuflow_transcribe_full():
    """Transcribe a complete audio recording (full-session mode)."""
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    filename = secure_filename(audio_file.filename) or 'session.webm'
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(filepath)

    try:
        target_lang = request.form.get('language', 'auto')
        print(f"[DocuFlow] 🎙️ Transcribing full session: {filename} ({target_lang})")
        asr_result = transcribe(filepath, target_lang=target_lang)
        text = asr_result.get("text", "").strip()
        detected_lang = asr_result.get("detected_lang", "en")
        lang_name = asr_result.get("lang_name", "Unknown")
        latency = asr_result.get("latency_ms", 0)
        print(f"   [DocuFlow] ✅ Full transcription: {len(text)} chars | {lang_name} | {latency}ms")
        return jsonify({
            "success": True,
            "text": text,
            "detected_lang": detected_lang,
            "lang_name": lang_name,
            "latency_ms": latency
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/api/docuflow/process_full', methods=['POST'])
def docuflow_process_full():
    """Full pipeline: raw transcript → speaker classification → structured report."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    raw_transcript = data.get('raw_transcript', '')
    patient_info = data.get('patient_info', {})
    language = data.get('language', 'English')

    if not raw_transcript.strip():
        return jsonify({"error": "Empty transcript"}), 400

    print(f"[DocuFlow] 📋 Processing full session: {len(raw_transcript)} chars")
    import time
    start = time.time()
    result = process_full_session(raw_transcript, patient_info, language)
    latency_ms = int((time.time() - start) * 1000)

    classified_transcript = result.get('transcript', [])
    report_data = result.get('report_data', {})

    if report_data.get("error"):
        return jsonify(report_data), 500

    # Create and persist the report
    report_id = create_report(patient_info, classified_transcript, language)
    report = load_report(report_id)
    report["report_data"] = report_data
    report["transcript"] = classified_transcript
    persist_report(report_id, report)

    print(f"[DocuFlow] ✅ Report {report_id} generated with {len(classified_transcript)} classified turns in {latency_ms}ms.")
    return jsonify({
        "success": True,
        "report_id": report_id,
        "report_data": report_data,
        "transcript": classified_transcript,
        "patient_info": patient_info,
        "latency_ms": latency_ms
    })


@app.route('/api/docuflow/reports', methods=['GET'])
def docuflow_list_reports():
    """List all saved reports."""
    reports = list_reports()
    return jsonify({"reports": reports})


@app.route('/api/docuflow/reports/<report_id>', methods=['GET'])
def docuflow_get_report(report_id):
    """Get a full report by ID."""
    report = load_report(report_id)
    if not report:
        return jsonify({"error": "Report not found"}), 404
    return jsonify(report)


@app.route('/api/docuflow/reports/<report_id>', methods=['DELETE'])
def docuflow_delete_report(report_id):
    """Delete a report."""
    if remove_report(report_id):
        return jsonify({"success": True})
    return jsonify({"error": "Report not found"}), 404


@app.route('/api/docuflow/reports/<report_id>/field', methods=['PUT'])
def docuflow_update_field(report_id):
    """Update a single field in a report (editable review)."""
    data = request.get_json()
    if not data or 'field' not in data or 'value' not in data:
        return jsonify({"error": "Missing field or value"}), 400
    updated = update_report_field(report_id, data['field'], data['value'])
    if not updated:
        return jsonify({"error": "Report not found"}), 404
    return jsonify({"success": True})


@app.route('/api/docuflow/reports/<report_id>/finalize', methods=['POST'])
def docuflow_finalize(report_id):
    """Mark a report as finalized."""
    report = finalize_report(report_id)
    if not report:
        return jsonify({"error": "Report not found"}), 404
    return jsonify({"success": True, "report": report})


@app.route('/api/docuflow/save_to_history', methods=['POST'])
def docuflow_save_to_history():
    """Save a finalized DocuFlow report as a session in the History tab."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    report_id = data.get('report_id', '')
    patient_info = data.get('patient_info', {})
    report_data = data.get('report_data', {})
    transcript = data.get('transcript', [])

    try:
        import json
        from datetime import datetime

        SESSIONS_DIR = "data/sessions"
        os.makedirs(SESSIONS_DIR, exist_ok=True)

        # Use the report ID as the session ID for easy cross-reference
        session_id = f"df-{report_id}"

        # Build session data from the report fields
        session_data = {}
        # Add patient info
        for k, v in patient_info.items():
            if v:
                session_data[f"patient_{k}"] = str(v)
        # Add key report fields
        for k, v in report_data.items():
            if v and v != 'N/A' and v != 'Not discussed':
                session_data[k] = str(v)[:200]  # cap preview length

        # Build history entries from the transcript
        history = []
        for i, turn in enumerate(transcript):
            speaker = turn.get('speaker', 'Unknown')
            text = turn.get('text', '')
            history.append({
                "turn": i + 1,
                "timestamp": datetime.now().isoformat(),
                "new_data": {},
                "user_utterance": text if speaker == 'Patient' else '',
                "ai_response": text if speaker == 'Doctor' else '',
                "cumulative": {}
            })

        session = {
            "session_id": session_id,
            "domain": "docuflow",
            "created_at": datetime.now().isoformat(),
            "turn": len(transcript),
            "language": "Multi-Language",
            "data": session_data,
            "history": history,
            "docuflow_report_id": report_id,
            "is_docuflow": True
        }

        session_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        with open(session_path, "w", encoding="utf-8") as f:
            json.dump(session, f, indent=2, ensure_ascii=False)

        print(f"[DocuFlow] ✅ Report {report_id} saved to History as session {session_id}")
        return jsonify({"success": True, "session_id": session_id})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
