'use strict';

const db = require('../db');
const { reserve } = require('../services/stock');

module.exports = async function publicRoutes(fastify) {
  // GET /api/catch/current — most recent published catch
  fastify.get('/catch/current', async (req, reply) => {
    const catchRow = db
      .prepare(
        `SELECT * FROM catches WHERE status = 'published'
         ORDER BY published_at DESC LIMIT 1`
      )
      .get();

    if (!catchRow) return reply.send({ catch: null });

    const items = db
      .prepare('SELECT * FROM fish_items WHERE catch_id = ?')
      .all(catchRow.id);

    return { catch: catchRow, items };
  });

  // GET /api/catch/:id/stock — real-time stock for polling
  fastify.get('/catch/:id/stock', async (req, reply) => {
    const { id } = req.params;
    const items = db
      .prepare('SELECT id, species, unit_type, total_quantity, remaining FROM fish_items WHERE catch_id = ?')
      .all(id);
    return { items };
  });

  // GET /api/catch/:id/items — all items for a catch
  fastify.get('/catch/:id/items', async (req, reply) => {
    const { id } = req.params;
    const items = db
      .prepare('SELECT * FROM fish_items WHERE catch_id = ?')
      .all(id);
    return { items };
  });

  // POST /api/reserve — create a reservation
  fastify.post('/reserve', {
    schema: {
      body: {
        type: 'object',
        required: ['fish_item_id', 'friend_name', 'friend_phone', 'quantity'],
        properties: {
          fish_item_id: { type: 'integer' },
          friend_name:  { type: 'string', minLength: 1, maxLength: 100 },
          friend_phone: { type: 'string', minLength: 1, maxLength: 30 },
          quantity:     { type: 'number', exclusiveMinimum: 0 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { fish_item_id, friend_name, friend_phone, quantity } = req.body;

    // Verify the fish item exists and belongs to a published catch
    const item = db.prepare(
      `SELECT fi.* FROM fish_items fi
       JOIN catches c ON c.id = fi.catch_id
       WHERE fi.id = ? AND c.status = 'published'`
    ).get(fish_item_id);

    if (!item) return reply.status(404).send({ error: 'Article introuvable ou pêche non publiée' });

    const result = reserve({ fish_item_id, friend_name, friend_phone, quantity });

    if (!result.ok) {
      if (result.reason === 'insufficient_stock') {
        return reply.status(409).send({ error: 'Stock insuffisant, essaie une quantité inférieure.' });
      }
      return reply.status(400).send({ error: 'Paramètres invalides' });
    }

    return reply.status(201).send({ reservation: result.reservation });
  });
};
