const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  } 
});

// Deployment version v1.3
const activeUsers = new Map(); // socketId -> { role }

const broadcastActiveUsers = () => {
  let adminCount = 0;
  let staffCount = 0;
  for (const user of activeUsers.values()) {
    if (user.role === 'admin') adminCount++;
    else if (user.role === 'staff') staffCount++;
  }
  io.emit('active_users', { admins: adminCount, staff: staffCount, total: adminCount + staffCount });
};

io.on('connection', (socket) => {
  socket.on('register', (data) => {
    console.log('Registering user:', data);
    if (data && data.role) {
      activeUsers.set(socket.id, { role: data.role });
      broadcastActiveUsers();
    }
  });

  socket.on('disconnect', () => {
    activeUsers.delete(socket.id);
    broadcastActiveUsers();
  });
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

const allowedOrigins = [
  'https://beatfajjaralghad.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-password', 'x-admin-secret'],
  credentials: true
}));

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware to check authentication (Admin or Staff)
const requireAuth = (req, res, next) => {
  const password = req.headers['x-auth-password'];
  const adminSecret = process.env.ADMIN_SECRET;
  const staffSecret = process.env.STAFF_SECRET;
  
  if (!adminSecret && !staffSecret) {
    return next();
  }

  if ((adminSecret && password === adminSecret) || (staffSecret && password === staffSecret)) {
    return next();
  }
  
  return res.status(401).json({ error: 'Unauthorized' });
};

// Middleware to check admin specifically
const requireAdmin = (req, res, next) => {
  const password = req.headers['x-auth-password'] || req.headers['x-admin-secret'];
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) return next();

  if (password === adminSecret) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Requires Admin Access' });
};

// API Routes
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const adminSecret = process.env.ADMIN_SECRET;
  const staffSecret = process.env.STAFF_SECRET;

  if (!adminSecret && !staffSecret) {
     return res.json({ role: 'admin' });
  }

  if (adminSecret && password === adminSecret) {
     return res.json({ role: 'admin' });
  } else if (staffSecret && password === staffSecret) {
     return res.json({ role: 'staff' });
  }

  res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
});

// Get all voters
app.get('/api/voters', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM voters ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import voters from CSV/Excel (Protected)
app.post('/api/voters/import', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    fs.unlinkSync(req.file.path);

    let importedCount = 0;
    
    // Use a transaction for bulk import
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of data) {
        let m_serial = String(row['م'] || '');
        let num = String(row['الرقم'] || '');
        let first_name = String(row['الأول الاسم'] || row['الاسم الأول'] || '');
        let father_name = String(row['الأب اسم'] || row['اسم الأب'] || '');
        let grand_name = String(row['الجد اسم'] || row['اسم الجد'] || '');
        let family_name = String(row['اللقب'] || row['العائلة'] || '');
        let code = String(row['الرمز'] || '');
        let national_id = row['الهوية رقم'] || row['رقم الهوية'] || row['NationalID'] || null;
        let school = String(row['المدرسة'] || '');
        
        if (national_id) national_id = String(national_id).trim();

        if (first_name || national_id) {
          await client.query(
            `INSERT INTO voters (m_serial, num, first_name, father_name, grand_name, family_name, code, national_id, school, voted) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)`,
            [m_serial, num, first_name, father_name, grand_name, family_name, code, national_id, school]
          );
          importedCount++;
        }
      }
      await client.query('COMMIT');
      res.json({ message: `Successfully imported ${importedCount} voters.`, count: importedCount });
    } catch (importErr) {
      await client.query('ROLLBACK');
      throw importErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Mark as voted (Atomic update in Postgres)
app.post('/api/voters/vote/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();
  
  try {
    // We remove the testing delay for production
    const updateResult = await db.query(
      'UPDATE voters SET voted = TRUE, time = $1 WHERE id = $2 AND voted = FALSE RETURNING *',
      [now, id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(400).json({ error: 'Voter not found or already voted' });
    }

    const updatedRow = updateResult.rows[0];
    io.emit('voter_updated', updatedRow);
    res.json(updatedRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route /api/reset-vote required by user
app.post('/api/reset-vote', async (req, res) => {
  try {
    const password = req.headers['x-auth-password'];
    const adminSecret = process.env.ADMIN_SECRET;
    
    if (adminSecret && password !== adminSecret) { 
        return res.status(401).json({ error: "كلمة مرور غير صحيحة" });
    }

    const result = await db.query('UPDATE voters SET voted = FALSE, time = NULL');
    res.status(200).json({ success: true, message: "تم تصفير سجل التصويت بنجاح", affected: result.rowCount });
  } catch (error) {
    console.error("Reset error:", error);
    res.status(500).json({ error: "فشل في تصفير السجل: " + error.message });
  }
});

// Reset database (Full delete) (Protected)
app.post('/api/voters/reset', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM voters');
    res.json({ message: 'تم مسح وحذف جميع الناخبين بشكل كامل' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset ONLY the voted status (Protected)
app.post('/api/clear-votes', requireAdmin, async (req, res) => {
  console.log("Attempting to clear all votes...");
  try {
    const result = await db.query('UPDATE voters SET voted = FALSE, time = NULL');
    console.log("Votes cleared successfully:", result.rowCount);
    res.json({ message: 'تم تصفير سجل التصويت بنجاح', affected: result.rowCount });
  } catch (err) {
    console.error("Clear votes error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Health check and debug
app.get('/api/health', (req, res) => {
  let adminCount = 0;
  let staffCount = 0;
  for (const user of activeUsers.values()) {
    if (user.role === 'admin') adminCount++;
    else if (user.role === 'staff') staffCount++;
  }
  res.json({ 
    status: 'ok', 
    version: '1.4',
    activeUsers: { admins: adminCount, staff: staffCount, total: activeUsers.size }
  });
});

// Strict JSON error handler for all /api routes
app.use('/api', (err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Strict JSON fallback for all unknown /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// --- API routes end here ---

// Serve static files from React app in production
const clientDistPath = path.join(__dirname, 'client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// SPA Catch-all: serve React app for any route not handled by API
app.use((req, res) => {
  if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  } else {
    res.status(404).send('Frontend not built yet. Run npm run build.');
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
