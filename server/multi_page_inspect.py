import pdfplumber
import json

pdf_path = "../voters.pdf.pdf"

pages_to_check = [0, 9, 19, 39]
results = {}

with pdfplumber.open(pdf_path) as pdf:
    for p_idx in pages_to_check:
        if p_idx < len(pdf.pages):
            page = pdf.pages[p_idx]
            table = page.extract_table()
            if table:
                results[f"page_{p_idx+1}"] = {
                    "row_count": len(table),
                    "sample_rows": table[:10]
                }
            else:
                results[f"page_{p_idx+1}"] = "No table found"

with open("multi_page_inspect.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
