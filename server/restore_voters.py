import sqlite3
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv
import sys

# Ensure UTF-8 output even on Windows
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# Load env from server/.env
load_dotenv('server/.env')
db_url = os.getenv("DATABASE_URL")

if not db_url:
    print("Error: DATABASE_URL not found in server/.env")
    exit(1)

# Connect to SQLite (Source)
try:
    lite_conn = sqlite3.connect('server/voters.db')
    lite_c = lite_conn.cursor()
    # 0:m_serial, 1:num, 2:first_name, 3:father_name, 4:grand_name, 5:family_name, 6:code, 7:national_id, 8:school, 9:voted, 10:time
    lite_c.execute("SELECT m_serial, num, first_name, father_name, grand_name, family_name, code, national_id, school, voted, time FROM voters")
    rows = lite_c.fetchall()
    
    # Process rows to ensure Postgres types
    voters_clean = []
    for r in rows:
        v_list = list(r)
        # Convert SQLite integer boolean (0/1) to Python boolean (False/True)
        v_list[9] = bool(v_list[9])
        voters_clean.append(tuple(v_list))
        
    print(f"Retrieved {len(voters_clean)} voters from SQLite.")
except Exception as e:
    print(f"SQLite Error: {str(e)}")
    exit(1)

# Connect to Postgres (Destination)
pg_conn = None
try:
    pg_conn = psycopg2.connect(db_url)
    pg_c = pg_conn.cursor()
    
    print("Clearing voters table in PostgreSQL...")
    pg_c.execute("TRUNCATE TABLE voters RESTART IDENTITY;")
    
    print(f"Restoring {len(voters_clean)} voters to PostgreSQL...")
    
    insert_query = """
    INSERT INTO voters (m_serial, num, first_name, father_name, grand_name, family_name, code, national_id, school, voted, time) 
    VALUES %s
    """
    
    psycopg2.extras.execute_values(
        pg_c,
        "INSERT INTO voters (m_serial, num, first_name, father_name, grand_name, family_name, code, national_id, school, voted, time) VALUES %s",
        voters_clean
    )
    
    pg_conn.commit()
    print("Restoration complete successfully!")
    
    pg_c.execute("SELECT count(*) FROM voters")
    new_count = pg_c.fetchone()[0]
    print(f"Verified count in PostgreSQL: {new_count}")

except Exception as e:
    print(f"PostgreSQL/Restoration Error: {str(e).encode('ascii', 'ignore').decode()}")
    if pg_conn:
        pg_conn.rollback()
finally:
    if 'lite_conn' in locals() and lite_conn: lite_conn.close()
    if pg_conn: 
        pg_c.close()
        pg_conn.close()
