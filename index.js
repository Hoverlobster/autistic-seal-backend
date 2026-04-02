const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
}));
app.use(express.json());

// Init tables
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("Database ready.");
}

// GET top 10 all-time scores
app.get("/api/scores", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT username, score, created_at
       FROM scores
       ORDER BY score DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

// POST a new score
app.post("/api/scores", async (req, res) => {
  const { username, score } = req.body;
  if (!username || score == null) return res.status(400).json({ error: "Missing fields" });
  try {
    await pool.query(
      "INSERT INTO scores (username, score) VALUES ($1, $2)",
      [username.trim().slice(0, 30), Math.floor(score)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save score" });
  }
});

// GET all suggestions (newest first)
app.get("/api/suggestions", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT username, message, created_at
       FROM suggestions
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

// POST a new suggestion
app.post("/api/suggestions", async (req, res) => {
  const { username, message } = req.body;
  if (!username || !message) return res.status(400).json({ error: "Missing fields" });
  try {
    await pool.query(
      "INSERT INTO suggestions (username, message) VALUES ($1, $2)",
      [username.trim().slice(0, 30), message.trim().slice(0, 300)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save suggestion" });
  }
});

app.get("/", (req, res) => res.send("Autistic Seal API is running."));

initDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});