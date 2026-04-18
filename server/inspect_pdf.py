import pdfplumber
import json

pdf_path = "../voters.pdf.pdf"
all_rows = []

with pdfplumber.open(pdf_path) as pdf:
    for page_num, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if row and any(cell for cell in row):
                    all_rows.append(row)

# Write first 5 rows to file to understand structure
with open("pdf_inspect_output.json", "w", encoding="utf-8") as f:
    json.dump({"total_rows": len(all_rows), "sample": all_rows[:5]}, f, ensure_ascii=False, indent=2)

print(f"Done. Total rows found: {len(all_rows)}. Check pdf_inspect_output.json")
