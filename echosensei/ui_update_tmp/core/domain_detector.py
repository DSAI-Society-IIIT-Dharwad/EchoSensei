from models.llm import query_llm

def detect_domain(text):
    prompt = f"""
Classify the domain of the following input:

Text: "{text}"

Possible domains:
- healthcare
- ecommerce
- finance
- general

Return ONLY one word.
"""
    return query_llm(prompt).strip().lower()