const { Pool } = require('pg');
require('dotenv').config();

// For Render, DATABASE_URL is provided in environment variables.
// Locally, you can create a .env file with DATABASE_URL or it will fail gracefully.
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false // Required for Render Postgres
});

const initializeDB = async () => {
  try {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL successfully!");

    // Create voters table
    await client.query(`
      CREATE TABLE IF NOT EXISTS voters (
        id SERIAL PRIMARY KEY,
        m_serial TEXT,
        num TEXT,
        first_name TEXT,
        father_name TEXT,
        grand_name TEXT,
        family_name TEXT,
        code TEXT,
        national_id TEXT,
        school TEXT,
        voted BOOLEAN DEFAULT FALSE,
        time TEXT
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_voters_first_name ON voters(first_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_voters_father_name ON voters(father_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_voters_family_name ON voters(family_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_voters_national_id ON voters(national_id)`);

    console.log("Database schema ready!");
    client.release();
  } catch (err) {
    console.error('Error connecting to PostgreSQL or creating schema:', err.message);
    if (!connectionString) {
      console.error('DATABASE_URL is missing. Please set it in environment variables.');
    }
  }
};

initializeDB();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool
};
