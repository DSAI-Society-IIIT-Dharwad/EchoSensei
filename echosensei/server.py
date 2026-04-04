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
        target_lang = request.form.get('language', 'hi')
        session_id = request.form.get('session_id', 'default_session')
        domain = request.form.get('domain', 'healthcare')

        print(f"🎙️ Transcribing {filepath} in '{target_lang}'...")
        asr_result = transcribe(filepath, target_lang=target_lang)
        native_text = asr_result["text"]
        lang_name = asr_result["lang_name"]

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


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
