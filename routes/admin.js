'use strict';

const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const db = require('../db');
const { verifyPassword, getStoredHash } = require('../services/auth');
const { cancelReservation } = require('../services/stock');
const { notifyAll } = require('../services/notify');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'public', 'uploads');

async function authenticate(req, reply) {
  try {
    await req.jwtVerify({ onlyCookie: true });
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' });
  }
}

module.exports = async function adminRoutes(fastify) {
  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC routes (no auth required)
  // ══════════════════════════════════════════════════════════════════════════

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['password'],
        properties: { password: { type: 'string' } },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { password } = req.body;
    if (!verifyPassword(password, getStoredHash())) {
      return reply.status(401).send({ error: 'Mot de passe incorrect' });
    }
    const token = fastify.jwt.sign({ role: 'admin' }, { expiresIn: '7d' });
    reply
      .setCookie('token', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: (process.env.PUBLIC_URL || '').startsWith('https'),
        maxAge: 60 * 60 * 24 * 7,
      })
      .send({ ok: true });
  });

  fastify.post('/logout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' }).send({ ok: true });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PROTECTED routes — child scope so preHandler only applies here
  // ══════════════════════════════════════════════════════════════════════════
  fastify.register(async function protectedAdmin(f) {
    f.addHook('preHandler', authenticate);

    // Verify token
    f.get('/me', async () => ({ role: 'admin' }));

    // ── Photo upload ─────────────────────────────────────────────────────────
    f.post('/upload', async (req, reply) => {
      const data = await req.file();
      if (!data) return reply.status(400).send({ error: 'Aucun fichier' });

      const ext = path.extname(data.filename).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext))
        return reply.status(400).send({ error: 'Type de fichier non autorisé' });

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      await pipeline(data.file, fs.createWriteStream(path.join(UPLOADS_DIR, fileName)));
      return { url: `/uploads/${fileName}` };
    });

    // ════════════════════════════════════════════════════════════════════════
    // CATCHES
    // ════════════════════════════════════════════════════════════════════════

    f.get('/catches', async () => {
      const catches = db.prepare(
        `SELECT c.*,
           COUNT(DISTINCT fi.id) AS item_count,
           COUNT(DISTINCT r.id)  AS reservation_count
         FROM catches c
         LEFT JOIN fish_items fi ON fi.catch_id = c.id
         LEFT JOIN reservations r ON r.fish_item_id = fi.id AND r.status = 'active'
         GROUP BY c.id
         ORDER BY c.created_at DESC`
      ).all();
      return { catches };
    });

    f.get('/catch/:id', async (req, reply) => {
      const catchRow = db.prepare('SELECT * FROM catches WHERE id = ?').get(req.params.id);
      if (!catchRow) return reply.status(404).send({ error: 'Pêche introuvable' });

      const items = db.prepare(
        `SELECT fi.*,
           COALESCE(SUM(CASE WHEN r.status='active' THEN r.quantity ELSE 0 END), 0) AS reserved
         FROM fish_items fi
         LEFT JOIN reservations r ON r.fish_item_id = fi.id
         WHERE fi.catch_id = ?
         GROUP BY fi.id`
      ).all(catchRow.id);

      const reservations = db.prepare(
        `SELECT r.*, fi.species, fi.unit_type
         FROM reservations r
         JOIN fish_items fi ON fi.id = r.fish_item_id
         WHERE fi.catch_id = ? AND r.status = 'active'
         ORDER BY r.reserved_at DESC`
      ).all(catchRow.id);

      return { catch: catchRow, items, reservations };
    });

    f.post('/catch', {
      schema: {
        body: {
          type: 'object', required: ['title'],
          properties: {
            title:     { type: 'string', minLength: 1 },
            location:  { type: 'string' },
            note:      { type: 'string' },
            photo_url: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    }, async (req, reply) => {
      const { title, location, note, photo_url } = req.body;
      const res = db.prepare('INSERT INTO catches (title, location, note, photo_url) VALUES (?,?,?,?)')
        .run(title, location || null, note || null, photo_url || null);
      return reply.status(201).send({ catch: db.prepare('SELECT * FROM catches WHERE id = ?').get(res.lastInsertRowid) });
    });

    f.put('/catch/:id', {
      schema: {
        body: {
          type: 'object',
          properties: {
            title:     { type: 'string', minLength: 1 },
            location:  { type: 'string' },
            note:      { type: 'string' },
            photo_url: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    }, async (req, reply) => {
      if (!db.prepare('SELECT id FROM catches WHERE id = ?').get(req.params.id))
        return reply.status(404).send({ error: 'Pêche introuvable' });

      const { title, location, note, photo_url } = req.body;
      db.prepare(
        `UPDATE catches SET
           title     = COALESCE(?, title),
           location  = COALESCE(?, location),
           note      = COALESCE(?, note),
           photo_url = COALESCE(?, photo_url)
         WHERE id = ?`
      ).run(title || null, location || null, note || null, photo_url || null, req.params.id);
      return { catch: db.prepare('SELECT * FROM catches WHERE id = ?').get(req.params.id) };
    });

    f.post('/catch/:id/publish', async (req, reply) => {
      const catchRow = db.prepare('SELECT * FROM catches WHERE id = ?').get(req.params.id);
      if (!catchRow) return reply.status(404).send({ error: 'Pêche introuvable' });
      if (catchRow.status === 'published') return reply.status(400).send({ error: 'Déjà publiée' });

      db.prepare(`UPDATE catches SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(req.params.id);

      const updated = db.prepare('SELECT * FROM catches WHERE id = ?').get(req.params.id);
      const items   = db.prepare('SELECT * FROM fish_items WHERE catch_id = ?').all(req.params.id);
      notifyAll(updated, items).catch(err => console.error('[publish] notify error:', err));
      return { catch: updated };
    });

    f.put('/catch/:id/archive', async (req, reply) => {
      if (!db.prepare('SELECT id FROM catches WHERE id = ?').get(req.params.id))
        return reply.status(404).send({ error: 'Pêche introuvable' });
      db.prepare(`UPDATE catches SET status = 'archived' WHERE id = ?`).run(req.params.id);
      return { catch: db.prepare('SELECT * FROM catches WHERE id = ?').get(req.params.id) };
    });

    f.delete('/catch/:id', async (req, reply) => {
      const catchRow = db.prepare('SELECT * FROM catches WHERE id = ?').get(req.params.id);
      if (!catchRow) return reply.status(404).send({ error: 'Pêche introuvable' });
      if (catchRow.status === 'published')
        return reply.status(400).send({ error: 'Archiver la pêche avant de la supprimer' });
      db.prepare('DELETE FROM catches WHERE id = ?').run(req.params.id);
      return { ok: true };
    });

    // ════════════════════════════════════════════════════════════════════════
    // FISH ITEMS
    // ════════════════════════════════════════════════════════════════════════

    f.post('/catch/:id/item', {
      schema: {
        body: {
          type: 'object', required: ['species', 'unit_type', 'total_quantity'],
          properties: {
            species:        { type: 'string', minLength: 1 },
            unit_type:      { type: 'string', enum: ['unit', 'kg', 'lot'] },
            total_quantity: { type: 'number', exclusiveMinimum: 0 },
            photo_url:      { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    }, async (req, reply) => {
      const { species, unit_type, total_quantity, photo_url } = req.body;
      const res = db.prepare(
        `INSERT INTO fish_items (catch_id, species, unit_type, total_quantity, remaining, photo_url)
         VALUES (?,?,?,?,?,?)`
      ).run(req.params.id, species, unit_type, total_quantity, total_quantity, photo_url || null);
      return reply.status(201).send({ item: db.prepare('SELECT * FROM fish_items WHERE id = ?').get(res.lastInsertRowid) });
    });

    f.put('/item/:id', {
      schema: {
        body: {
          type: 'object',
          properties: {
            species:        { type: 'string', minLength: 1 },
            unit_type:      { type: 'string', enum: ['unit', 'kg', 'lot'] },
            total_quantity: { type: 'number', exclusiveMinimum: 0 },
            remaining:      { type: 'number', minimum: 0 },
            photo_url:      { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    }, async (req, reply) => {
      if (!db.prepare('SELECT id FROM fish_items WHERE id = ?').get(req.params.id))
        return reply.status(404).send({ error: 'Article introuvable' });

      const { species, unit_type, total_quantity, remaining, photo_url } = req.body;
      db.prepare(
        `UPDATE fish_items SET
           species        = COALESCE(?, species),
           unit_type      = COALESCE(?, unit_type),
           total_quantity = COALESCE(?, total_quantity),
           remaining      = COALESCE(?, remaining),
           photo_url      = COALESCE(?, photo_url)
         WHERE id = ?`
      ).run(species || null, unit_type || null, total_quantity ?? null, remaining ?? null, photo_url || null, req.params.id);
      return { item: db.prepare('SELECT * FROM fish_items WHERE id = ?').get(req.params.id) };
    });

    f.delete('/item/:id', async (req, reply) => {
      if (!db.prepare('SELECT id FROM fish_items WHERE id = ?').get(req.params.id))
        return reply.status(404).send({ error: 'Article introuvable' });
      db.prepare('DELETE FROM fish_items WHERE id = ?').run(req.params.id);
      return { ok: true };
    });

    // ════════════════════════════════════════════════════════════════════════
    // RESERVATIONS
    // ════════════════════════════════════════════════════════════════════════

    f.get('/reservations', async (req) => {
      const { catch_id } = req.query;
      let query = `
        SELECT r.*, fi.species, fi.unit_type, c.title AS catch_title
        FROM reservations r
        JOIN fish_items fi ON fi.id = r.fish_item_id
        JOIN catches c ON c.id = fi.catch_id
        WHERE r.status = 'active'`;
      const params = [];
      if (catch_id) { query += ' AND c.id = ?'; params.push(catch_id); }
      query += ' ORDER BY r.reserved_at DESC';
      return { reservations: db.prepare(query).all(...params) };
    });

    f.delete('/reservation/:id', async (req, reply) => {
      const result = cancelReservation(req.params.id);
      if (!result.ok) return reply.status(400).send({ error: result.reason });
      return { ok: true };
    });

    // ════════════════════════════════════════════════════════════════════════
    // FRIENDS
    // ════════════════════════════════════════════════════════════════════════

    f.get('/friends', async () => ({
      friends: db.prepare('SELECT * FROM friends ORDER BY name').all(),
    }));

    f.post('/friend', {
      schema: {
        body: {
          type: 'object', required: ['name'],
          properties: {
            name:  { type: 'string', minLength: 1 },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    }, async (req, reply) => {
      const { name, phone, email } = req.body;
      const res = db.prepare('INSERT INTO friends (name, phone, email) VALUES (?,?,?)')
        .run(name, phone || null, email || null);
      return reply.status(201).send({ friend: db.prepare('SELECT * FROM friends WHERE id = ?').get(res.lastInsertRowid) });
    });

    f.put('/friend/:id', {
      schema: {
        body: {
          type: 'object',
          properties: {
            name:  { type: 'string', minLength: 1 },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    }, async (req, reply) => {
      if (!db.prepare('SELECT id FROM friends WHERE id = ?').get(req.params.id))
        return reply.status(404).send({ error: 'Ami introuvable' });

      const { name, phone, email } = req.body;
      db.prepare(
        `UPDATE friends SET
           name  = COALESCE(?, name),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email)
         WHERE id = ?`
      ).run(name || null, phone || null, email || null, req.params.id);
      return { friend: db.prepare('SELECT * FROM friends WHERE id = ?').get(req.params.id) };
    });

    f.delete('/friend/:id', async (req, reply) => {
      if (!db.prepare('SELECT id FROM friends WHERE id = ?').get(req.params.id))
        return reply.status(404).send({ error: 'Ami introuvable' });
      db.prepare('DELETE FROM friends WHERE id = ?').run(req.params.id);
      return { ok: true };
    });
  }); // end protectedAdmin
};
