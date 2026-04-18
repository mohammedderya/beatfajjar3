import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

conn = psycopg2.connect(db_url)
c = conn.cursor()

# Search for "محمد"
c.execute("SELECT first_name, father_name, grand_name, family_name FROM voters WHERE first_name LIKE '%محمد%' OR father_name LIKE '%محمد%' LIMIT 5")
rows = c.fetchall()

print("Search results for 'محمد' in PostgreSQL:")
for r in rows:
    print(f"- {r[0]} {r[1]} {r[2]} {r[3]}")

c.close()
conn.close()
