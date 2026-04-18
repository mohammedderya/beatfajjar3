import pdfplumber
import json

pdf_path = "../voters.pdf.pdf"

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[0]
    
    # Let's find all characters on the first line to see if we missed anything in the ID cell
    # Row 1 ID is 5771090. Let's find the characters near that value.
    chars = page.chars
    id_chars = [c for c in chars if c['top'] > 79 and c['top'] < 95 and c['x0'] > 150 and c['x1'] < 300]
    
    # Sort by x0
    id_chars.sort(key=lambda x: x['x0'])
    
    # Print the characters
    print("Found ID characters on Page 1 Row 1:")
    for c in id_chars:
        print(f"Char: '{c['text']}' at x0: {c['x0']:.2f}")

    # Check for '9' specifically
    all_nines = [c for c in chars if c['text'] == '9']
    print(f"\nTotal '9' chars on page 1: {len(all_nines)}")
