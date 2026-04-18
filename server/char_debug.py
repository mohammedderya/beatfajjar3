import pdfplumber
import json

pdf_path = "../voters.pdf.pdf"

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[0]
    chars = page.chars
    
    # Analyze the ID cell area of the first row
    # Row 1 ID '5771090' is around y=85. Let's look at all chars in that horizontal strip.
    strip = [c for c in chars if c['top'] > 80 and c['top'] < 90]
    strip.sort(key=lambda x: x['x0'])
    
    char_sequence = "".join([c['text'] for c in strip])
    
    results = {
        "strip_text": char_sequence,
        "strip_details": [{ "text": c['text'], "x0": float(c['x0']), "x1": float(c['x1']) } for c in strip]
    }

with open("char_debug.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
