'use strict';

const db = require('../db');

/**
 * Create a reservation within a SQLite transaction.
 * Uses optimistic locking: UPDATE ... WHERE remaining >= quantity.
 * Returns { ok: true, reservation } or { ok: false, reason }
 */
function reserve({ fish_item_id, friend_name, friend_phone, quantity }) {
  if (!fish_item_id || !friend_name || !friend_phone || !quantity || quantity <= 0) {
    return { ok: false, reason: 'invalid_params' };
  }

  const doReserve = db.transaction(() => {
    // Atomic decrement — only succeeds if enough stock remains
    const update = db.prepare(
      `UPDATE fish_items
          SET remaining = remaining - ?
        WHERE id = ? AND remaining >= ?`
    );
    const info = update.run(quantity, fish_item_id, quantity);

    if (info.changes === 0) {
      return { ok: false, reason: 'insufficient_stock' };
    }

    const insert = db.prepare(
      `INSERT INTO reservations (fish_item_id, friend_name, friend_phone, quantity)
       VALUES (?, ?, ?, ?)`
    );
    const result = insert.run(fish_item_id, friend_name, friend_phone, quantity);

    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(result.lastInsertRowid);
    return { ok: true, reservation };
  });

  return doReserve();
}

/**
 * Cancel a reservation and restore stock.
 */
function cancelReservation(reservationId) {
  const cancel = db.transaction(() => {
    const res = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
    if (!res) return { ok: false, reason: 'not_found' };
    if (res.status === 'cancelled') return { ok: false, reason: 'already_cancelled' };

    db.prepare(`UPDATE fish_items SET remaining = remaining + ? WHERE id = ?`)
      .run(res.quantity, res.fish_item_id);

    db.prepare(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`)
      .run(reservationId);

    return { ok: true };
  });
  return cancel();
}

/**
 * Get current stock snapshot for a catch.
 */
function getStock(catchId) {
  return db.prepare(
    `SELECT id, species, unit_type, total_quantity, remaining, photo_url
       FROM fish_items WHERE catch_id = ?`
  ).all(catchId);
}

module.exports = { reserve, cancelReservation, getStock };
