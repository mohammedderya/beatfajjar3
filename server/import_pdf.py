import pdfplumber
import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

pdf_path = "../voters.pdf.pdf"
db_url = os.getenv("DATABASE_URL")

def normalize_text(text):
    if not text:
        return ''
    # Reverse the raw text FIRST (since pdfplumber extracts some RTL fonts backwards)
    text = text[::-1].strip()
    # Now replace ligatures with standard characters
    text = text.replace('\ufdf4', 'محمد')
    text = text.replace('\ufdf2', 'الله')
    return text

def clean_school(parts):
    # Filter empty parts and normalize each
    cleaned = [normalize_text(p) for p in parts if p]
    # Join with space
    return " ".join(cleaned)

all_rows = []

print("Reading PDF pages and extracting tables...")
with pdfplumber.open(pdf_path) as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if row and any(cell for cell in row):
                    all_rows.append(row)

print(f"Total rows found: {len(all_rows)}. Processing...")

if not db_url:
    print("ERROR: DATABASE_URL not found in environment variables.")
    exit(1)

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# Clear old data
cursor.execute("DELETE FROM voters")
conn.commit()

imported = 0
skipped = 0

for row in all_rows:
    try:
        row_len = len(row)
        if row_len == 13:
            m_serial    = str(row[12] or '').strip()
            num         = str(row[11] or '').strip()
            first_name  = normalize_text(row[10])
            father_name = normalize_text(row[9])
            grand_name  = normalize_text(row[8])
            family_name = normalize_text(row[7])
            code        = str(row[6] or '').strip()
            national_id = str(row[5] or '').strip()
            school      = clean_school(row[0:5])
        elif row_len == 12:
            m_serial    = str(row[11] or '').strip()
            num         = str(row[10] or '').strip()
            first_name  = normalize_text(row[9])
            father_name = normalize_text(row[8])
            grand_name  = normalize_text(row[7])
            family_name = normalize_text(row[6])
            code        = str(row[5] or '').strip()
            national_id = str(row[4] or '').strip()
            school      = clean_school(row[0:4])
        elif row_len == 11:
            m_serial    = str(row[10] or '').strip()
            num         = str(row[9] or '').strip()
            first_name  = normalize_text(row[8])
            father_name = normalize_text(row[7])
            grand_name  = normalize_text(row[6])
            family_name = normalize_text(row[5])
            code        = str(row[4] or '').strip()
            national_id = str(row[3] or '').strip()
            school      = clean_school(row[0:3])
        else:
            skipped += 1
            continue

        if not m_serial.isdigit() or not first_name or not national_id:
            skipped += 1
            continue

        cursor.execute("""
            INSERT INTO voters (m_serial, num, first_name, father_name, grand_name, family_name, code, national_id, school, voted)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
        """, (m_serial, num, first_name, father_name, grand_name, family_name, code, national_id, school))
        imported += 1

    except Exception as e:
        skipped += 1

conn.commit()
cursor.close()
conn.close()

print(f"Processing complete! Imported {imported} voters to PostgreSQL.")
