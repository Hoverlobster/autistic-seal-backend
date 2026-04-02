const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors({
  origin: '*'
}));
app.use(express.json());

// Init tables
pool.query(`
  CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS suggestions (
    id SERIAL PRIMARY KEY,
    username TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
`).then(() => console.log('Tables ready')).catch(console.error);

// POST /api/scores
app.post("/api/scores", async (req, res) => {
  const { username, score, session_id } = req.body;
  try {
    await pool.query(`
      INSERT INTO scores (username, score, session_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (session_id) DO UPDATE
      SET score = GREATEST(scores.score, EXCLUDED.score)
    `, [username, score, session_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

// GET /api/scores
app.get("/api/scores", async (req, res) => {
  try {
    const data = await pool.query(`
      SELECT username, score
      FROM scores
      ORDER BY score DESC
      LIMIT 10
    `);
    res.json(data.rows);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.get('/api/suggestions', async (req, res) => {
  try {
    const result = await pool.query('SELECT username, message, created_at FROM suggestions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/scores', async (req, res) => {
  const { username, score } = req.body;
  try {
    await pool.query(`
      INSERT INTO scores (username, score) VALUES ($1, $2)
      ON CONFLICT (username) DO UPDATE SET score = GREATEST(scores.score, EXCLUDED.score)
    `, [username, score]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
