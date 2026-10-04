const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── DB connection pool ────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'Subha@2007',
  database: process.env.DB_NAME     || 'hospital',
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true   // allows running DDL + DML in one call
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/ping', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── List all tables ───────────────────────────────────────────────────────────
app.get('/api/tables', async (req, res) => {
  try {
    const [rows] = await pool.query('SHOW TABLES');
    const key = Object.keys(rows[0] || {})[0];
    res.json(rows.map(r => r[key]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get table data (with optional pagination) ─────────────────────────────────
app.get('/api/table/:name', async (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${name}\``);
    const [rows] = await pool.query(`SELECT * FROM \`${name}\` LIMIT ? OFFSET ?`, [limit, offset]);
    const [cols] = await pool.query(`DESCRIBE \`${name}\``);
    res.json({ total, rows, columns: cols, page, limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get column info for a table ───────────────────────────────────────────────
app.get('/api/table/:name/columns', async (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
  try {
    const [cols] = await pool.query(`DESCRIBE \`${name}\``);
    res.json(cols);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Execute arbitrary SQL (DDL + DML) ────────────────────────────────────────
app.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql || !sql.trim()) return res.status(400).json({ error: 'No SQL provided' });
  try {
    const conn = await pool.getConnection();
    try {
      // Split on semicolons (ignoring empties), run each statement
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      const results = [];
      for (const stmt of statements) {
        const [result] = await conn.query(stmt);
        results.push({
          statement: stmt.substring(0, 120),
          affectedRows: result.affectedRows ?? null,
          rows: Array.isArray(result) ? result : null,
          insertId: result.insertId ?? null
        });
      }
      res.json({ success: true, results });
    } finally {
      conn.release();
    }
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ── DML: Insert row ───────────────────────────────────────────────────────────
app.post('/api/table/:name/row', async (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
  const data = req.body;
  try {
    const [result] = await pool.query(`INSERT INTO \`${name}\` SET ?`, [data]);
    res.json({ success: true, insertId: result.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── DML: Update row ───────────────────────────────────────────────────────────
app.put('/api/table/:name/row', async (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
  const { pkColumn, pkValue, data } = req.body;
  try {
    const sets = Object.keys(data).map(k => `\`${k}\` = ?`).join(', ');
    const vals = [...Object.values(data), pkValue];
    const [result] = await pool.query(
      `UPDATE \`${name}\` SET ${sets} WHERE \`${pkColumn}\` = ?`, vals
    );
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── DML: Delete row ───────────────────────────────────────────────────────────
app.delete('/api/table/:name/row', async (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
  const { pkColumn, pkValue } = req.body;
  try {
    const [result] = await pool.query(
      `DELETE FROM \`${name}\` WHERE \`${pkColumn}\` = ?`, [pkValue]
    );
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Schema: Get CREATE TABLE statement ────────────────────────────────────────
app.get('/api/table/:name/schema', async (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
  try {
    const [[row]] = await pool.query(`SHOW CREATE TABLE \`${name}\``);
    res.json({ schema: row['Create Table'] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏥 Hospital DB Manager running → http://localhost:${PORT}`);
});
