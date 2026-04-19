import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('server/.env')
db_url = os.getenv("DATABASE_URL")

def emergency_reset():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Count current voted
        cur.execute("SELECT COUNT(*) FROM voters WHERE voted = TRUE")
        voted_count = cur.fetchone()[0]
        print(f"Current voted count: {voted_count}")
        
        # 2. Reset
        print("Resetting voting status in database...")
        cur.execute("UPDATE voters SET voted = FALSE, time = NULL")
        conn.commit()
        
        # 3. Verify
        cur.execute("SELECT COUNT(*) FROM voters WHERE voted = TRUE")
        new_count = cur.fetchone()[0]
        print(f"New voted count: {new_count}")
        print("SUCCESS: Voting status has been cleared directly in the database!")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    emergency_reset()
