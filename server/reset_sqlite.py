import sqlite3
import os

db_path = 'server/voters.db'

def reset_sqlite():
    if not os.path.exists(db_path):
        print(f"SQLite DB not found at {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Check current voted
        cur.execute("SELECT COUNT(*) FROM voters WHERE voted = 1")
        count = cur.fetchone()[0]
        print(f"Current SQLite voted count: {count}")
        
        if count > 0:
            print("Resetting SQLite voting status...")
            cur.execute("UPDATE voters SET voted = 0, time = NULL")
            conn.commit()
            print("RESET SUCCESSFUL in SQLite!")
        else:
            print("SQLite is already at 0.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"SQLite Error: {e}")

if __name__ == "__main__":
    reset_sqlite()
