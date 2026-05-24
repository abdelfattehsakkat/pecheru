'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'fishcall.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS friends (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      phone       TEXT,
      email       TEXT,
      push_subscription TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catches (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      location     TEXT,
      note         TEXT,
      photo_url    TEXT,
      status       TEXT NOT NULL DEFAULT 'draft',
      published_at DATETIME,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fish_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      catch_id       INTEGER NOT NULL REFERENCES catches(id) ON DELETE CASCADE,
      species        TEXT NOT NULL,
      unit_type      TEXT NOT NULL CHECK(unit_type IN ('unit','kg','lot')),
      total_quantity REAL NOT NULL,
      remaining      REAL NOT NULL,
      photo_url      TEXT
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      fish_item_id INTEGER NOT NULL REFERENCES fish_items(id) ON DELETE CASCADE,
      friend_name  TEXT NOT NULL,
      friend_phone TEXT NOT NULL,
      quantity     REAL NOT NULL,
      status       TEXT NOT NULL DEFAULT 'active',
      reserved_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

migrate();

module.exports = db;
