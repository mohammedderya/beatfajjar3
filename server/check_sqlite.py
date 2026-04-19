import sqlite3
import os

db_path = 'server/voters.db'
if not os.path.exists(db_path):
    print(f'Database not found at {db_path}')
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT count(*) FROM voters")
    count = cursor.fetchone()[0]
    print(f'Total voters in SQLite: {count}')

    cursor.execute("PRAGMA table_info(voters)")
    columns = cursor.fetchall()
    print('Columns in voters table:')
    for col in columns:
        print(f' - {col[1]} ({col[2]})')
except Exception as e:
    print(f'Error: {e}')

conn.close()
