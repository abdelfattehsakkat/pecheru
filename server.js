'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const fastify = require('fastify')({ logger: true });

// ── Plugins ──────────────────────────────────────────────────────────────────
fastify.register(require('@fastify/cookie'));

fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'changeme-strong-secret',
  cookie: { cookieName: 'token', signed: false },
});

fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Ensure uploads directory exists
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// ── Routes ───────────────────────────────────────────────────────────────────
fastify.register(require('./routes/public'), { prefix: '/api' });
fastify.register(require('./routes/push'),   { prefix: '/api/push' });
fastify.register(require('./routes/admin'),  { prefix: '/api/admin' });

// ── SPA fallback: serve index.html for non-API routes ────────────────────────
fastify.setNotFoundHandler((req, reply) => {
  if (!req.url.startsWith('/api')) {
    return reply.sendFile('index.html');
  }
  reply.status(404).send({ error: 'Not found' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  fastify.log.info(`FishCall running on port ${PORT}`);
});
