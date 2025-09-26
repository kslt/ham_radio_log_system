const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./db');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

async function register(email, password, callsign) {
  const hash = await bcrypt.hash(password, 10);
  const [res] = await pool.query(
    'INSERT INTO users (email, password_hash, callsign) VALUES (?, ?, ?)',
    [email, hash, callsign]
  );
  return res.insertId;
}

async function login(email, password) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0) return null;
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  const token = jwt.sign(
    { id: user.id, email: user.email, callsign: user.callsign, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  return { token, user: { id: user.id, email: user.email, callsign: user.callsign, role: user.role } };
}

function middleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'no token' });
  const parts = h.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid auth' });
  try {
    req.user = jwt.verify(parts[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

module.exports = { register, login, middleware };
