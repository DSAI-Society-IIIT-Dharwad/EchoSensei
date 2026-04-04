from langdetect import detect, DetectorFactory
DetectorFactory.seed = 0

HINDI_ROMAN_KEYWORDS = [
    "kiya", "kar", "hai", "tha", "nahi", "mera", "meri", "aur", "lekin",
    "abhi", "kal", "aaj", "sir", "bhai", "rupees", "rupaya", "paisa",
    "hazaar", "lakh", "maine", "humne", "tumne", "apna", "apni", "wala",
    "bolo", "batao", "karo", "chahiye", "milega", "hua", "hoga", "hain"
]

# Languages that need translation to English before extraction
NEEDS_TRANSLATION = {
    "Hindi", "Hinglish", "Kannada", "Urdu", "Tamil", "Telugu",
    "Malayalam", "Marathi", "Gujarati", "Bengali"
}

# langdetect code → friendly name
LANG_CODE_MAP = {
    "hi": "Hindi",
    "kn": "Kannada",
    "en": "English",
    "ur": "Urdu",       # ← Urdu is now properly mapped
    "ta": "Tamil",
    "te": "Telugu",
    "ml": "Malayalam",
    "mr": "Marathi",
    "gu": "Gujarati",
    "bn": "Bengali",
    "pa": "Punjabi",
}

# Unicode ranges for Indic scripts
SCRIPT_RANGES = [
    ('\u0900', '\u097F', "Hindi"),       # Devanagari
    ('\u0C80', '\u0CFF', "Kannada"),
    ('\u0B80', '\u0BFF', "Tamil"),
    ('\u0C00', '\u0C7F', "Telugu"),
    ('\u0D00', '\u0D7F', "Malayalam"),
    ('\u0A80', '\u0AFF', "Gujarati"),
    ('\u0980', '\u09FF', "Bengali"),
    ('\u0600', '\u06FF', "Urdu"),        # Arabic/Urdu script ← NEW
    ('\u0A00', '\u0A7F', "Punjabi"),
]


def detect_language(text: str) -> str:
    """
    Detects language of given text.
    Handles Devanagari, Kannada, Urdu/Arabic script, and Roman-script Hindi (Hinglish).
    """
    if not text or not text.strip():
        return "Unknown"

    # Check for known Indic/Arabic Unicode script ranges
    for start, end, lang_name in SCRIPT_RANGES:
        if any(start <= ch <= end for ch in text):
            return lang_name

    # Check for Roman-script Hindi keywords (Hinglish / code-mixed)
    lower_words = text.lower().split()
    hindi_keyword_count = sum(1 for word in HINDI_ROMAN_KEYWORDS if word in lower_words)
    if hindi_keyword_count >= 2:
        return "Hinglish"

    # Fallback: langdetect
    try:
        lang_code = detect(text)
        return LANG_CODE_MAP.get(lang_code, f"Other ({lang_code})")
    except Exception:
        return "English"


def needs_translation(lang: str) -> bool:
    """Returns True if the language needs to be translated to English before LLM processing."""
    return lang in NEEDS_TRANSLATION


def is_code_mixed(text: str) -> bool:
    """Returns True if the text appears to mix Hindi and English."""
    lower_words = text.lower().split()
    hindi_count = sum(1 for w in HINDI_ROMAN_KEYWORDS if w in lower_words)
    english_common = ["i", "my", "the", "is", "was", "not", "but", "and", "have", "has"]
    english_count = sum(1 for w in english_common if w in lower_words)
    return hindi_count >= 1 and english_count >= 1
