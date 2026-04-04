import json
import re

def clean_json(response):
    try:
        # Remove markdown if present
        response = re.sub(r"```json|```", "", response)

        # Extract JSON block
        match = re.search(r"\{.*\}", response, re.DOTALL)

        if match:
            json_str = match.group()

            # Fix common formatting issues
            json_str = json_str.replace("\n", "").strip()

            return json.loads(json_str)

    except Exception as e:
        print("Parsing error:", e)

    return response