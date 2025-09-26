require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const pool = require('./db');
const { register, login, middleware } = require('./auth');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(express.static('public'));

// Register
app.post('/api/register', async (req, res) => {
  const { email, password, callsign } = req.body;
  try {
    const id = await register(email, password, callsign);
    res.json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await login(email, password);
  if (!result) return res.status(401).json({ error: 'invalid creds' });
  res.json(result);
});

// Uppdatera locator
app.post('/api/me/locator', middleware, async (req, res) => {
  const { locator } = req.body;
  try {
    await pool.query('UPDATE users SET locator=? WHERE id=?', [locator, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Hämta alla locatorer
app.get('/api/users/locators', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, callsign, locator FROM users WHERE locator IS NOT NULL'
  );
  res.json(rows);
});

// Logga QSO
app.post('/api/contests/:cid/qsos', middleware, async (req, res) => {
  const { datetime_utc, band, mode, their_call, rst_sent, rst_rcvd, exchange_sent, exchange_rcvd } = req.body;
  try {
    await pool.query(
      `INSERT INTO qsos (contest_id, user_id, datetime_utc, band, mode, their_call, rst_sent, rst_rcvd, exchange_sent, exchange_rcvd, points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.params.cid, req.user.id, datetime_utc, band, mode, their_call, rst_sent, rst_rcvd, exchange_sent, exchange_rcvd]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Leaderboard
app.get('/api/contests/:cid/leaderboard', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.callsign, SUM(q.points) as score, COUNT(q.id) as qsos
     FROM users u
     LEFT JOIN qsos q ON q.user_id = u.id AND q.contest_id = ?
     GROUP BY u.id ORDER BY score DESC`,
    [req.params.cid]
  );
  res.json(rows);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on', port));
