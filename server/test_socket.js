const { io } = require("socket.io-client");
const sqlite3 = require('sqlite3');
const path = require('path');
const http = require('http');

console.log("Step 1: Client 2 connecting to WebSocket server (simulating 2nd device)...");
const socket = io("http://localhost:3001");

socket.on("connect", () => {
    console.log("-> WebSocket connection successful!");
    
    const dbPath = path.resolve(__dirname, 'voters.db');
    const db = new sqlite3.Database(dbPath, (err) => {
        if(err) {
            console.error("DB error", err);
            process.exit(1);
        }
        
        db.run('DELETE FROM voters;', () => {
            db.run(`INSERT INTO voters (first_name, national_id, voted) VALUES ('TestUser', '1234', 0)`, function(err) {
                const newId = this.lastID;
                console.log(`-> Mock User created (ID: ${newId}).`);
                console.log(`-> Client 2 listening silently for updates...\n`);
                
                socket.on("voter_updated", (data) => {
                    console.log(`========================================================`);
                    console.log(`✅ SUCCESS: WEB-SOCKET LIVE BROADCAST RECEIVED!`);
                    console.log(`-> User '${data.first_name}' (ID ${data.id}) just turned Green!`);
                    console.log(`========================================================\n`);
                    process.exit(0);
                });

                console.log(`Step 2: Client 1 simultaneously clicks "Record Attendance" via HTTP Action...`);
                const req = http.request({
                    hostname: 'localhost',
                    port: 3001,
                    path: `/api/voters/vote/${newId}`,
                    method: 'POST'
                }, res => {
                    console.log(`-> HTTP Request Sent (Client 1) -> Server Processing for 1.5 seconds...`);
                });
                req.end();
            });
        });
    });
});
