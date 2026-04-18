const fs = require('fs');
const pdf = require('pdf-parse');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'voters.db');
const db = new sqlite3.Database(dbPath);

let dataBuffer = fs.readFileSync('../voters.pdf.pdf');

pdf(dataBuffer).then(function(data) {
    const lines = data.text.split('\n');
    let imported = 0;
    
    db.serialize(() => {
        // Clear old data for a fresh start with this pure PDF data
        db.run('DELETE FROM voters;');
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(`INSERT INTO voters (m_serial, num, first_name, father_name, grand_name, family_name, code, national_id, school, voted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`);
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Fix: require num to start with a number and have a comma if thousands.
            // (\d+?) matches m_serial (1, 2, 10, 300)
            // (\d+,\d+|\d{1,4}) matches num like 5,835 or 835
            const match = trimmed.match(/^(\d+?)(\d+,\d+)([^\d]+)(57[78])(\d+)(.*?)$/);
            
            if (match) {
                let m_serial = match[1];
                let num = match[2];
                let nameStr = match[3].trim();
                let code = match[4];
                let national_id = match[5];
                let school = match[6] || '';
                
                stmt.run([m_serial, num, nameStr, '', '', '', code, national_id, school]);
                imported++;
            }
        }
        
        db.run('COMMIT', (err) => {
            stmt.finalize();
            console.log(`Successfully parsed and imported ${imported} voters directly from PDF!`);
        });
    });

}).catch(err => {
    console.error("Error reading PDF:", err);
});
