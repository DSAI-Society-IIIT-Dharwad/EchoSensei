import time
import traceback
import subprocess
import os

# ── Resolve ffmpeg path ──────────────────────────────────────────────────────
FFMPEG_PATH = "ffmpeg"
local_ffmpeg = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ffmpeg.exe"))
if os.path.exists(local_ffmpeg):
    FFMPEG_PATH = local_ffmpeg
    print(f"[ASR] Using local ffmpeg.exe: {FFMPEG_PATH}")
else:
    try:
        import imageio_ffmpeg
        FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
        print(f"[ASR] Using ffmpeg from imageio: {FFMPEG_PATH}")
    except ImportError:
        print("[ASR] imageio_ffmpeg not found, using system ffmpeg")

LANG_NAMES = {
    "hi": "Hindi", "ta": "Tamil", "kn": "Kannada", "en": "English",
    "auto": "Auto-Detect"
}

# ── Try IndicConformer first, fallback to Whisper ────────────────────────────
USE_INDIC = False
indic_model = None
whisper_model = None

try:
    import torch
    import torchaudio
    from transformers import AutoModel
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("[ASR] Attempting to load AI4Bharat IndicConformer...")
    indic_model = AutoModel.from_pretrained(
        "ai4bharat/indic-conformer-600m-multilingual",
        trust_remote_code=True
    )
    indic_model = indic_model.to(device)
    indic_model.eval()
    USE_INDIC = True
    print("[ASR] ✅ IndicConformer loaded successfully.")
except Exception as e:
    print(f"[ASR] ⚠️ IndicConformer unavailable: {e}")
    print("[ASR] Falling back to OpenAI Whisper...")
    try:
        import whisper
        whisper_model = whisper.load_model("tiny")
        print("[ASR] ✅ Whisper 'tiny' model loaded as fallback.")
    except Exception as e2:
        print(f"[ASR] ❌ Whisper also failed: {e2}")


def _convert_to_wav(audio_path: str) -> str:
    """Convert any audio format to 16kHz mono WAV using ffmpeg."""
    temp_wav = audio_path + ".wav"
    result = subprocess.run(
        [FFMPEG_PATH, "-y", "-i", audio_path, "-vn", "-preset", "ultrafast", "-ar", "16000", "-ac", "1", temp_wav],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if result.returncode != 0:
        print(f"[ASR] ffmpeg stderr: {result.stderr.decode()}")
        raise RuntimeError(f"ffmpeg conversion failed (code {result.returncode})")
    return temp_wav


def _transcribe_indic(wav_path: str, target_lang: str) -> str:
    """Transcribe using IndicConformer."""
    import torch, torchaudio
    wav, sr = torchaudio.load(wav_path)
    wav = torch.mean(wav, dim=0, keepdim=True)
    if sr != 16000:
        wav = torchaudio.transforms.Resample(sr, 16000)(wav)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    wav = wav.to(device)
    with torch.no_grad():
        out = indic_model(wav, target_lang, "ctc")
    return out[0] if isinstance(out, list) else str(out)


def _transcribe_whisper(wav_path: str) -> tuple:
    """Transcribe using Whisper. Returns (text, detected_lang)."""
    result = whisper_model.transcribe(
        wav_path, task="translate", language=None,
        fp16=False, beam_size=1, best_of=1, temperature=0,
        condition_on_previous_text=False
    )
    text = (result.get("text") or "").strip()
    lang = (result.get("language") or "en").lower().strip()
    return text, lang


def transcribe(audio_path: str, target_lang: str = "hi") -> dict:
    """
    Main transcription entry point.
    Converts audio to WAV, then uses IndicConformer or Whisper.
    """
    start = time.time()

    start = time.time()

    import requests
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if groq_api_key:
        print("[ASR] ⚡ Using lightning-fast Groq Whisper API...")
        try:
            url = "https://api.groq.com/openai/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {groq_api_key}"}
            with open(audio_path, "rb") as f:
                files = {"file": (os.path.basename(audio_path), f, "audio/webm")}
                data = {
                    "model": "whisper-large-v3-turbo", 
                    "temperature": "0", 
                    "response_format": "verbose_json"
                }
                if target_lang != "auto" and target_lang in LANG_NAMES:
                    data["language"] = target_lang
                response = requests.post(url, headers=headers, files=files, data=data, timeout=15)
            response.raise_for_status()
            res_json = response.json()
            raw_text = res_json.get("text", "")
            import re
            # Strip out whispered hallucinations like [music], (sigh), *cough*
            text = re.sub(r'\[.*?\]|\(.*?\)', '', raw_text)
            text = text.replace('*', '').strip()
            
            # Groq API returns full language names (e.g. 'tamil') when using verbose_json
            detected_lang = res_json.get("language", target_lang).lower()
            code_mapper = {"tamil": "ta", "hindi": "hi", "kannada": "kn", "english": "en"}
            detected_lang = code_mapper.get(detected_lang, detected_lang)
            
            if detected_lang not in LANG_NAMES and target_lang == "auto":
                detected_lang = "en" # fallback
                
            latency_ms = int((time.time() - start) * 1000)
            lang_name = LANG_NAMES.get(detected_lang, detected_lang.upper())
            print(f"   [ASR] Groq Transcription: {text} | Detected Lang: {detected_lang} | Latency: {latency_ms} ms")
            return {
                "text": text, "detected_lang": detected_lang, "lang_name": lang_name,
                "was_translated": False, "latency_ms": latency_ms
            }
        except Exception as e:
            print(f"[ASR] ⚠️ Groq API failed, falling back locally: {e}")

    if target_lang == "auto" or target_lang not in LANG_NAMES:
        target_lang = "hi"

    try:
        wav_path = _convert_to_wav(audio_path)
    except Exception as e:
        traceback.print_exc()
        return {"text": f"Audio conversion failed: {e}", "detected_lang": target_lang,
                "lang_name": "Error", "was_translated": False, "latency_ms": 0}

    try:
        if USE_INDIC and indic_model is not None:
            text = _transcribe_indic(wav_path, target_lang)
            detected_lang = target_lang
        elif whisper_model is not None:
            text, detected_lang = _transcribe_whisper(wav_path)
            target_lang = detected_lang
        else:
            return {"text": "No ASR model available.", "detected_lang": "en",
                    "lang_name": "Error", "was_translated": False, "latency_ms": 0}
    except Exception as e:
        traceback.print_exc()
        return {"text": f"Transcription failed: {e}", "detected_lang": target_lang,
                "lang_name": "Error", "was_translated": False, "latency_ms": 0}
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)

    latency_ms = int((time.time() - start) * 1000)
    lang_name = LANG_NAMES.get(target_lang, target_lang.upper())

    print(f"   [ASR] Engine: {'IndicConformer' if USE_INDIC else 'Whisper'}")
    print(f"   [ASR] Language: {lang_name} ({target_lang})")
    print(f"   [ASR] Output: {text}")
    print(f"   [ASR] Latency: {latency_ms} ms")

    return {
        "text": text,
        "detected_lang": target_lang,
        "lang_name": lang_name,
        "was_translated": target_lang != "en",
        "latency_ms": latency_ms
    }

