import pdfplumber
import json

pdf_path = "../voters.pdf.pdf"

with pdfplumber.open(pdf_path) as pdf:
    first_page = pdf.pages[0]
    table = first_page.extract_table()
    
    # We want to see row 1 and 2 (skipping header if exists, but extract_table usually gets it all)
    # Let's see the first 5 rows
    results = []
    for i, row in enumerate(table[:5]):
        results.append({
            "index": i,
            "row": row,
            "id_cell": row[5] if len(row) > 5 else "N/A",
            "code_cell": row[6] if len(row) > 6 else "N/A"
        })

with open("detailed_inspect.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
