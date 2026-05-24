'use strict';

/**
 * Simple single-user auth.
 * The admin password is stored hashed (bcrypt) but since we avoid extra deps,
 * we use a SHA-256 HMAC approach with the JWT secret.
 * The plain password is set via ADMIN_PASSWORD env var.
 */

const crypto = require('crypto');

function hashPassword(plain) {
  const secret = process.env.JWT_SECRET || 'changeme-strong-secret';
  return crypto.createHmac('sha256', secret).update(plain).digest('hex');
}

function verifyPassword(plain, hash) {
  return hashPassword(plain) === hash;
}

/**
 * Returns the stored password hash.
 * On first run the env var ADMIN_PASSWORD_HASH is expected.
 * If absent, fall back to hashing ADMIN_PASSWORD (convenient for dev).
 */
function getStoredHash() {
  if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
  const plain = process.env.ADMIN_PASSWORD || 'fishcall2024';
  return hashPassword(plain);
}

module.exports = { hashPassword, verifyPassword, getStoredHash };
