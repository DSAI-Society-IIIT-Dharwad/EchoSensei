import os
import sys
import logging
from flask import Flask, send_from_directory, request, jsonify
from werkzeug.utils import secure_filename

# Optional: Add CORS if needed, though frontend is on same port
from flask_cors import CORS

try:
    from models.asr import transcribe
    from models.llm import process_medical_turn
    from core.memory import update_session, get_session_data
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
        # Get target language from frontend (default hi for IndicConformer)
        target_lang = request.form.get('language', 'hi')
        session_id = request.form.get('session_id', 'default_session')

        # Step 1: Run local AI4Bharat IndicConformer (or Whisper fallback)
        print(f"🎙️ Transcribing {filepath} in '{target_lang}'...")
        asr_result = transcribe(filepath, target_lang=target_lang)
        native_text = asr_result["text"]
        lang_name = asr_result["lang_name"]

        # Step 2: Grab conversation history from memory
        session_data = get_session_data(session_id)

        # Step 3: Run single-pass Medical LLM (Extraction + Akinator follow-up)
        print(f"🤖 Processing turn for language: {lang_name}")
        llm_response = process_medical_turn(native_text, lang_name, session_data)

        # Step 4: Update Session Memory with any new extracted data
        new_data = llm_response.get("new_extracted_data", {})
        if new_data:
            update_session(session_id, new_data, domain="healthcare")
        
        updated_session = get_session_data(session_id)

        return jsonify({
            "success": True,
            "transcription": asr_result,
            "analysis": {"domain": "healthcare", "data": updated_session},
            "akinator": llm_response
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Error during processing: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
