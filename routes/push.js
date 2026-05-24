'use strict';

const db = require('../db');

module.exports = async function pushRoutes(fastify) {
  // GET /api/push/vapid-public-key
  fastify.get('/vapid-public-key', async () => ({
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
  }));

  // POST /api/push/subscribe
  fastify.post('/subscribe', {
    schema: {
      body: {
        type: 'object',
        required: ['subscription'],
        properties: {
          subscription: { type: 'object' },
          name:  { type: 'string' },
          phone: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { subscription, name, phone } = req.body;
    const subStr = JSON.stringify(subscription);

    // Upsert: update existing friend or create anonymous entry
    if (name && phone) {
      const existing = db.prepare('SELECT * FROM friends WHERE phone = ?').get(phone);
      if (existing) {
        db.prepare('UPDATE friends SET push_subscription = ? WHERE id = ?')
          .run(subStr, existing.id);
      } else {
        db.prepare('INSERT INTO friends (name, phone, push_subscription) VALUES (?,?,?)')
          .run(name, phone, subStr);
      }
    } else {
      // Anonymous subscription — store by endpoint
      const endpoint = subscription.endpoint;
      const existing = db.prepare(
        "SELECT id FROM friends WHERE push_subscription LIKE ?"
      ).get(`%${endpoint}%`);

      if (!existing) {
        db.prepare('INSERT INTO friends (name, push_subscription) VALUES (?,?)')
          .run('(anonyme)', subStr);
      } else {
        db.prepare('UPDATE friends SET push_subscription = ? WHERE id = ?')
          .run(subStr, existing.id);
      }
    }

    return reply.status(201).send({ ok: true });
  });

  // DELETE /api/push/unsubscribe
  fastify.delete('/unsubscribe', {
    schema: {
      body: {
        type: 'object',
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { endpoint } = req.body;
    const friends = db.prepare('SELECT id, push_subscription FROM friends WHERE push_subscription IS NOT NULL').all();
    for (const f of friends) {
      try {
        const sub = JSON.parse(f.push_subscription);
        if (sub.endpoint === endpoint) {
          db.prepare('UPDATE friends SET push_subscription = NULL WHERE id = ?').run(f.id);
          break;
        }
      } catch {}
    }
    return { ok: true };
  });
};
