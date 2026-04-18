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

# Analyse skipped rows
skipped_samples = []
short_rows = []
bad_national_id = []

for row in all_rows:
    if len(row) < 13:
        short_rows.append({"len": len(row), "row": row})
        continue
    
    national_id = str(row[5] or '').strip()
    
    if not national_id.isdigit():
        bad_national_id.append({"national_id": national_id, "row": row})

result = {
    "total_rows": len(all_rows),
    "short_rows_count": len(short_rows),
    "short_rows_sample": short_rows[:5],
    "bad_national_id_count": len(bad_national_id),
    "bad_national_id_sample": bad_national_id[:10]
}

with open("debug_skipped.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Done. Total={len(all_rows)}, Short={len(short_rows)}, BadID={len(bad_national_id)}")
