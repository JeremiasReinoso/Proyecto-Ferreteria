const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { randomUUID } = require("crypto");

const dbPath = path.join(__dirname, "inventory.db");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onResult(error) {
            if (error) return reject(error);
            resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) return reject(error);
            resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) return reject(error);
            resolve(rows);
        });
    });
}

async function initDb() {
    await run(`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price INTEGER NOT NULL CHECK(price > 0),
            stock INTEGER NOT NULL CHECK(stock >= 0),
            sold INTEGER NOT NULL DEFAULT 0 CHECK(sold >= 0),
            low_notified INTEGER NOT NULL DEFAULT 0,
            out_notified INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    const countRow = await get("SELECT COUNT(*) AS count FROM products");
    if (countRow && countRow.count > 0) return;

    const now = new Date().toISOString();
    const seed = [
        [randomUUID(), "Martillo de acero", "Herramientas", 12500, 22, 0, 0, 0, now, now],
        [randomUUID(), "Destornillador Phillips", "Herramientas", 6400, 14, 0, 0, 0, now, now],
        [randomUUID(), "Bolsa de cemento 50kg", "Construccion", 9800, 9, 0, 0, 0, now, now],
        [randomUUID(), "Llave francesa 10", "Herramientas", 8700, 4, 0, 0, 0, now, now]
    ];

    for (const row of seed) {
        await run(
            `INSERT INTO products (id, name, category, price, stock, sold, low_notified, out_notified, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row
        );
    }
}

module.exports = {
    db,
    run,
    get,
    all,
    initDb
};
