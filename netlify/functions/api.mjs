import { getDatabase } from "@netlify/database";

const db = getDatabase();

// Keep dates/timestamps as plain strings (no timezone shifting) and only
// convert the types the UI needs as real JSON values.
const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701]);
const types = {
  getTypeParser(oid) {
    if (oid === 16) return (v) => v === "t";
    if (NUMERIC_OIDS.has(oid)) return (v) => Number(v);
    if (oid === 114 || oid === 3802) return (v) => JSON.parse(v);
    return (v) => v;
  },
};

const query = (text, values = []) => db.pool.query({ text, values, types });
const ident = (name) => `"${String(name).replace(/"/g, '""')}"`;

// Schema changes are managed by migrations in netlify/database/migrations,
// so the console only allows reading and writing data.
const BLOCKED = /^\s*(create|alter|drop|truncate|grant|revoke|comment|reindex|vacuum|cluster)\b/i;

const json = (data, status = 200) => Response.json(data, { status });

async function listTables() {
  const { rows } = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return rows.map((r) => r.table_name);
}

async function assertTable(name) {
  const tables = await listTables();
  if (!tables.includes(name)) {
    const err = new Error(`Table "${name}" does not exist`);
    err.status = 404;
    throw err;
  }
}

// Column metadata in the shape the UI expects (Field, Type, Null, Key, Default, Extra)
async function describe(table) {
  const { rows } = await query(
    `SELECT c.column_name, c.data_type, c.udt_name, c.character_maximum_length,
            c.is_nullable, c.column_default,
            (SELECT string_agg(quote_literal(e.enumlabel), ',' ORDER BY e.enumsortorder)
               FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
              WHERE t.typname = c.udt_name) AS enum_values,
            EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                      JOIN information_schema.key_column_usage k
                        ON k.constraint_name = tc.constraint_name AND k.table_schema = tc.table_schema
                     WHERE tc.table_schema = 'public' AND tc.table_name = c.table_name
                       AND tc.constraint_type = 'PRIMARY KEY' AND k.column_name = c.column_name) AS is_pk,
            EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                      JOIN information_schema.key_column_usage k
                        ON k.constraint_name = tc.constraint_name AND k.table_schema = tc.table_schema
                     WHERE tc.table_schema = 'public' AND tc.table_name = c.table_name
                       AND tc.constraint_type = 'FOREIGN KEY' AND k.column_name = c.column_name) AS is_fk,
            EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                      JOIN information_schema.key_column_usage k
                        ON k.constraint_name = tc.constraint_name AND k.table_schema = tc.table_schema
                     WHERE tc.table_schema = 'public' AND tc.table_name = c.table_name
                       AND tc.constraint_type = 'UNIQUE' AND k.column_name = c.column_name) AS is_unique
       FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position`,
    [table]
  );

  return rows.map((c) => {
    let type = c.data_type;
    if (c.enum_values) type = `enum(${c.enum_values})`;
    else if (c.character_maximum_length) type = `${c.data_type === "character varying" ? "varchar" : c.data_type}(${c.character_maximum_length})`;
    const serial = typeof c.column_default === "string" && c.column_default.startsWith("nextval(");
    return {
      Field: c.column_name,
      Type: type,
      Null: c.is_nullable,
      Key: c.is_pk ? "PRI" : c.is_fk ? "MUL" : c.is_unique ? "UNI" : "",
      Default: serial ? null : c.column_default,
      Extra: serial ? "auto_increment" : "",
    };
  });
}

async function createStatement(table) {
  const cols = await describe(table);
  const { rows: cons } = await query(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = $1
      ORDER BY c.contype DESC, c.conname`,
    [table]
  );
  const lines = cols.map((c) => {
    let line = `  ${c.Field} ${c.Extra === "auto_increment" ? "SERIAL" : c.Type.toUpperCase()}`;
    if (c.Null === "NO" && c.Key !== "PRI") line += " NOT NULL";
    if (c.Default !== null) line += ` DEFAULT ${c.Default}`;
    return line;
  });
  cons.forEach((c) => lines.push(`  ${c.def}`));
  return `CREATE TABLE ${table} (\n${lines.join(",\n")}\n);`;
}

function pickColumns(cols, data) {
  const allowed = new Set(cols.map((c) => c.Field));
  return Object.keys(data || {}).filter((k) => allowed.has(k));
}

async function handle(req, segments) {
  const method = req.method;
  const [root, name, sub] = segments;

  if (root === "ping" && method === "GET") {
    await query("SELECT 1");
    return json({ ok: true });
  }

  if (root === "tables" && method === "GET") {
    return json(await listTables());
  }

  if (root === "overview" && method === "GET") {
    const [stock, totals, expiring, pending] = await Promise.all([
      query(`SELECT blood_group::text AS blood_group, COUNT(*) AS units
               FROM blood_units WHERE status = 'Available' GROUP BY blood_group`),
      query(`SELECT (SELECT COUNT(*) FROM donors) AS donors,
                    (SELECT COUNT(*) FROM hospitals) AS hospitals,
                    (SELECT COUNT(*) FROM blood_units WHERE status = 'Available') AS available,
                    (SELECT COALESCE(SUM(volume_ml), 0) FROM donations) AS volume`),
      query(`SELECT unit_id, blood_group::text AS blood_group, expiry_date::text AS expiry_date,
                    (expiry_date - CURRENT_DATE) AS days_left
               FROM blood_units WHERE status = 'Available' ORDER BY expiry_date LIMIT 5`),
      query(`SELECT r.request_id, h.name AS hospital, r.blood_group::text AS blood_group,
                    r.units_needed, r.request_date::text AS request_date
               FROM requests r JOIN hospitals h ON h.hospital_id = r.hospital_id
              WHERE r.status = 'Pending' ORDER BY r.request_date, r.request_id`),
    ]);
    return json({
      stock: stock.rows,
      totals: totals.rows[0],
      expiring: expiring.rows,
      pending: pending.rows,
    });
  }

  if (root === "query" && method === "POST") {
    const { sql } = await req.json().catch(() => ({}));
    if (!sql || !sql.trim()) return json({ error: "No SQL provided" }, 400);
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
    const blocked = statements.find((s) => BLOCKED.test(s.replace(/^(--[^\n]*\n\s*)+/, "")));
    if (blocked) {
      return json({
        success: false,
        error: "Schema changes (CREATE, ALTER, DROP, TRUNCATE…) are managed through database migrations and can't be run from the console. SELECT, INSERT, UPDATE and DELETE are all available.",
      }, 400);
    }
    try {
      const results = [];
      for (const stmt of statements) {
        const result = await query(stmt);
        const returnsRows = Array.isArray(result.fields) && result.fields.length > 0;
        results.push({
          statement: stmt.substring(0, 120),
          command: result.command,
          affectedRows: returnsRows ? null : result.rowCount ?? null,
          rows: returnsRows ? result.rows : null,
        });
      }
      return json({ success: true, results });
    } catch (e) {
      return json({ success: false, error: e.message }, 400);
    }
  }

  if (root === "table" && name) {
    await assertTable(name);

    if (!sub && method === "GET") {
      const url = new URL(req.url);
      const page = Math.max(parseInt(url.searchParams.get("page")) || 1, 1);
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit")) || 50, 1), 500);
      const columns = await describe(name);
      const pk = columns.find((c) => c.Key === "PRI")?.Field || columns[0]?.Field;
      const [{ rows: [{ total }] }, { rows }] = await Promise.all([
        query(`SELECT COUNT(*) AS total FROM ${ident(name)}`),
        query(
          `SELECT * FROM ${ident(name)} ORDER BY ${ident(pk)} LIMIT $1 OFFSET $2`,
          [limit, (page - 1) * limit]
        ),
      ]);
      return json({ total, rows, columns, page, limit });
    }

    if (sub === "columns" && method === "GET") {
      return json(await describe(name));
    }

    if (sub === "schema" && method === "GET") {
      return json({ schema: await createStatement(name) });
    }

    if (sub === "row") {
      const body = await req.json().catch(() => ({}));
      const cols = await describe(name);
      const validCol = (c) => cols.some((x) => x.Field === c);

      try {
        if (method === "POST") {
          const keys = pickColumns(cols, body);
          if (!keys.length) return json({ error: "No values provided" }, 400);
          const pk = cols.find((c) => c.Key === "PRI")?.Field || cols[0].Field;
          const { rows } = await query(
            `INSERT INTO ${ident(name)} (${keys.map(ident).join(", ")})
             VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})
             RETURNING ${ident(pk)} AS id`,
            keys.map((k) => body[k])
          );
          return json({ success: true, insertId: rows[0]?.id ?? null });
        }

        if (method === "PUT") {
          const { pkColumn, pkValue, data } = body;
          if (!validCol(pkColumn)) return json({ error: "Invalid key column" }, 400);
          const keys = pickColumns(cols, data);
          if (!keys.length) return json({ error: "No values provided" }, 400);
          const sets = keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(", ");
          const result = await query(
            `UPDATE ${ident(name)} SET ${sets} WHERE ${ident(pkColumn)} = $${keys.length + 1}`,
            [...keys.map((k) => data[k]), pkValue]
          );
          return json({ success: true, affectedRows: result.rowCount });
        }

        if (method === "DELETE") {
          const { pkColumn, pkValue } = body;
          if (!validCol(pkColumn)) return json({ error: "Invalid key column" }, 400);
          const result = await query(
            `DELETE FROM ${ident(name)} WHERE ${ident(pkColumn)} = $1`,
            [pkValue]
          );
          return json({ success: true, affectedRows: result.rowCount });
        }
      } catch (e) {
        return json({ error: e.message }, 400);
      }
    }
  }

  return json({ error: "Not found" }, 404);
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  try {
    return await handle(req, segments);
  } catch (e) {
    return json({ ok: false, error: e.message }, e.status || 500);
  }
};

export const config = {
  path: "/api/*",
};
