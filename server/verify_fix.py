import sqlite3

conn = sqlite3.connect('voters.db')
c = conn.cursor()

# Check for "محمد"
c.execute("SELECT first_name, father_name, grand_name, family_name, national_id FROM voters WHERE first_name LIKE '%محمد%' OR father_name LIKE '%محمد%' LIMIT 3")
results = c.fetchall()

print(f"Total rows found for 'محمد': {len(results)}")
for r in results:
    # Print as list to see parts
    print(list(r))

# Check specific row (Wael)
c.execute("SELECT first_name, father_name, grand_name, family_name FROM voters WHERE m_serial='1'")
wael = c.fetchone()
print(f"Row 1 (Wael): {list(wael)}")

conn.close()
