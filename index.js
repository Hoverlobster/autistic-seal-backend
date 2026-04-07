const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(cors({ origin: "*" }));
app.use(express.json());

// Init tables — username UNIQUE so ON CONFLICT works
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      score INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      username TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("Tables ready");
}

// GET top 10
app.get("/api/scores", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT username, score FROM scores ORDER BY score DESC LIMIT 10"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

// POST score — saves once per session end, keeps best score per username
app.post("/api/scores", async (req, res) => {
  const { username, score } = req.body;
  if (!username || score == null) {
    return res.status(400).json({ error: "Missing username or score" });
  }
  try {
    await pool.query(
      `INSERT INTO scores (username, score)
       VALUES ($1, $2)
       ON CONFLICT (username)
       DO UPDATE SET score = GREATEST(scores.score, EXCLUDED.score)`,
      [username.trim().slice(0, 30), Math.floor(score)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

// GET suggestions
app.get("/api/suggestions", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT username, message, created_at FROM suggestions ORDER BY created_at DESC LIMIT 50"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

// POST suggestion
app.post("/api/suggestions", async (req, res) => {
  const { username, message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Missing message" });
  }
  try {
    await pool.query(
      "INSERT INTO suggestions (username, message) VALUES ($1, $2)",
      [
        username ? username.trim().slice(0, 30) : "anonymous",
        message.trim().slice(0, 300),
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

app.get("/", (req, res) => res.send("Autistic Seal API running."));

initDB()
  .then(() => app.listen(PORT, () => console.log(`Server on port ${PORT}`)))
  .catch((err) => { console.error("DB init failed:", err); process.exit(1); });
