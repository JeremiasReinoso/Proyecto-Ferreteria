const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const { initDb, all, get, run } = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);
const lowStockLimit = Number(process.env.LOW_STOCK_LIMIT || 10);

const smtpConfigured = Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.ALERT_EMAIL_TO &&
    process.env.SMTP_FROM
);

const transporter = smtpConfigured
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    })
    : null;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/config", (_req, res) => {
    res.json({ lowStockLimit, emailEnabled: smtpConfigured });
});

app.get("/api/products", async (req, res) => {
    try {
        const search = String(req.query.search || "").trim().toLowerCase();

        const rows = search
            ? await all(
                `SELECT * FROM products
                 WHERE lower(name) LIKE ? OR lower(category) LIKE ?
                 ORDER BY updated_at DESC`,
                [`%${search}%`, `%${search}%`]
            )
            : await all("SELECT * FROM products ORDER BY updated_at DESC");

        res.json(rows.map(normalizeProduct));
    } catch (error) {
        respondError(res, error);
    }
});

app.get("/api/summary", async (_req, res) => {
    try {
        const row = await get(
            `SELECT
                COUNT(*) AS totalProducts,
                COALESCE(SUM(stock), 0) AS totalStock,
                COALESCE(SUM(sold), 0) AS soldTotal,
                COALESCE(SUM(CASE WHEN stock > 0 AND stock <= ? THEN 1 ELSE 0 END), 0) AS lowStock,
                COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) AS outOfStock
             FROM products`,
            [lowStockLimit]
        );
        res.json(row);
    } catch (error) {
        respondError(res, error);
    }
});

app.post("/api/products", async (req, res) => {
    try {
        const payload = parseProductPayload(req.body, false);
        const now = new Date().toISOString();
        const id = randomUUID();

        await run(
            `INSERT INTO products (id, name, category, price, stock, sold, low_notified, out_notified, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
            [id, payload.name, payload.category, payload.price, payload.stock, now, now]
        );

        const created = await get("SELECT * FROM products WHERE id = ?", [id]);
        await triggerStockAlerts(created);
        res.status(201).json(normalizeProduct(created));
    } catch (error) {
        respondError(res, error);
    }
});

app.put("/api/products/:id", async (req, res) => {
    try {
        const payload = parseProductPayload(req.body, true);
        const existing = await get("SELECT * FROM products WHERE id = ?", [req.params.id]);

        if (!existing) {
            res.status(404).json({ error: "Producto no encontrado." });
            return;
        }

        const next = {
            name: payload.name ?? existing.name,
            category: payload.category ?? existing.category,
            price: payload.price ?? existing.price,
            stock: payload.stock ?? existing.stock
        };

        const resetFlags = resolveAlertFlags(existing, next.stock);
        const now = new Date().toISOString();

        await run(
            `UPDATE products
             SET name = ?, category = ?, price = ?, stock = ?, low_notified = ?, out_notified = ?, updated_at = ?
             WHERE id = ?`,
            [next.name, next.category, next.price, next.stock, resetFlags.lowNotified, resetFlags.outNotified, now, req.params.id]
        );

        const updated = await get("SELECT * FROM products WHERE id = ?", [req.params.id]);
        await triggerStockAlerts(updated);
        res.json(normalizeProduct(updated));
    } catch (error) {
        respondError(res, error);
    }
});

app.post("/api/products/:id/sell", async (req, res) => {
    try {
        const qty = Number(req.body.quantity || 1);
        if (!Number.isInteger(qty) || qty <= 0) {
            res.status(400).json({ error: "La cantidad vendida debe ser un entero mayor a 0." });
            return;
        }

        const product = await get("SELECT * FROM products WHERE id = ?", [req.params.id]);
        if (!product) {
            res.status(404).json({ error: "Producto no encontrado." });
            return;
        }
        if (product.stock < qty) {
            res.status(400).json({ error: "No hay stock suficiente para esta venta." });
            return;
        }

        const now = new Date().toISOString();
        await run(
            `UPDATE products
             SET stock = stock - ?, sold = sold + ?, updated_at = ?
             WHERE id = ?`,
            [qty, qty, now, req.params.id]
        );

        const updated = await get("SELECT * FROM products WHERE id = ?", [req.params.id]);
        await triggerStockAlerts(updated);
        res.json(normalizeProduct(updated));
    } catch (error) {
        respondError(res, error);
    }
});

app.delete("/api/products/:id", async (req, res) => {
    try {
        const deleted = await run("DELETE FROM products WHERE id = ?", [req.params.id]);
        if (!deleted.changes) {
            res.status(404).json({ error: "Producto no encontrado." });
            return;
        }
        res.status(204).send();
    } catch (error) {
        respondError(res, error);
    }
});

start();

function parseProductPayload(body, partial) {
    const parsed = {
        name: body.name?.trim(),
        category: body.category?.trim(),
        price: body.price !== undefined ? Number(body.price) : undefined,
        stock: body.stock !== undefined ? Number(body.stock) : undefined
    };

    if (!partial) {
        if (!parsed.name || !parsed.category) throw badRequest("Nombre y categoria son obligatorios.");
        if (!Number.isFinite(parsed.price) || parsed.price <= 0) throw badRequest("El precio debe ser mayor a 0.");
        if (!Number.isInteger(parsed.stock) || parsed.stock < 0) throw badRequest("El stock debe ser un entero >= 0.");
    } else {
        if (parsed.name !== undefined && !parsed.name) throw badRequest("El nombre no puede estar vacio.");
        if (parsed.category !== undefined && !parsed.category) throw badRequest("La categoria no puede estar vacia.");
        if (parsed.price !== undefined && (!Number.isFinite(parsed.price) || parsed.price <= 0)) {
            throw badRequest("El precio debe ser mayor a 0.");
        }
        if (parsed.stock !== undefined && (!Number.isInteger(parsed.stock) || parsed.stock < 0)) {
            throw badRequest("El stock debe ser un entero >= 0.");
        }
    }

    return parsed;
}

function resolveAlertFlags(current, nextStock) {
    const lowNotified = nextStock > lowStockLimit ? 0 : current.low_notified;
    const outNotified = nextStock > 0 ? 0 : current.out_notified;
    return { lowNotified, outNotified };
}

async function triggerStockAlerts(product) {
    if (!smtpConfigured || !transporter) return;

    const lowNeeded = product.stock > 0 && product.stock <= lowStockLimit && !product.low_notified;
    const outNeeded = product.stock === 0 && !product.out_notified;

    if (lowNeeded) {
        const sent = await sendEmail(
            `Alerta de stock bajo: ${product.name}`,
            `El producto "${product.name}" quedo con ${product.stock} unidades.`
        );
        if (sent) {
            await run("UPDATE products SET low_notified = 1 WHERE id = ?", [product.id]);
            product.low_notified = 1;
        }
    }

    if (outNeeded) {
        const sent = await sendEmail(
            `Producto agotado: ${product.name}`,
            `El producto "${product.name}" se quedo sin stock.`
        );
        if (sent) {
            await run("UPDATE products SET out_notified = 1 WHERE id = ?", [product.id]);
            product.out_notified = 1;
        }
    }
}

async function sendEmail(subject, text) {
    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: process.env.ALERT_EMAIL_TO,
            subject,
            text
        });
        return true;
    } catch (error) {
        console.error("No se pudo enviar email:", error.message);
        return false;
    }
}

function normalizeProduct(row) {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        price: row.price,
        stock: row.stock,
        sold: row.sold,
        lowNotified: Boolean(row.low_notified),
        outNotified: Boolean(row.out_notified),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function respondError(res, error) {
    console.error(error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: status === 500 ? "Error interno del servidor." : error.message });
}

async function start() {
    try {
        await initDb();
        app.listen(port, () => {
            console.log(`Servidor iniciado en http://localhost:${port}`);
            if (!smtpConfigured) {
                console.log("Notificaciones por email desactivadas: falta configurar SMTP en .env");
            }
        });
    } catch (error) {
        console.error("No se pudo iniciar la aplicacion:", error);
        process.exit(1);
    }
}
