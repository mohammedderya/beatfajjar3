import sqlite3

conn = sqlite3.connect('voters.db')
c = conn.cursor()

# Search for "محمد"
c.execute("SELECT first_name FROM voters WHERE first_name LIKE '%محمد%' OR father_name LIKE '%محمد%' LIMIT 5")
rows = c.fetchall()

# Write to file to check actual bytes/text
with open("verify_muhammad.txt", "w", encoding="utf-8") as f:
    f.write(f"Search results for 'محمد':\n")
    for r in rows:
        f.write(f"- {r[0]}\n")

conn.close()
print("Verification file written: verify_muhammad.txt")
