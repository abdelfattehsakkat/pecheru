'use strict';

const nodemailer = require('nodemailer');
const webpush = require('web-push');
const db = require('../db');

// ── VAPID setup ───────────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@fishcall.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ── Mailer ────────────────────────────────────────────────────────────────────
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildEmailHtml(catchRow, items) {
  const itemsHtml = items
    .map((it) => {
      const qty =
        it.unit_type === 'unit' ? `${it.total_quantity} unité(s)`
        : it.unit_type === 'kg'  ? `${it.total_quantity} kg`
        : 'Lot disponible';
      return `<li><strong>${it.species}</strong> — ${qty}</li>`;
    })
    .join('');

  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3000';

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;color:#1a3a4a">
  <h1 style="color:#0077b6">🎣 Wael Ridene vient de rentrer de pêche !</h1>
  <p><strong>Pêche :</strong> ${catchRow.title}</p>
  ${catchRow.location ? `<p><strong>Lieu :</strong> ${catchRow.location}</p>` : ''}
  ${catchRow.note ? `<p>${catchRow.note}</p>` : ''}
  <h2>Disponible :</h2>
  <ul>${itemsHtml}</ul>
  <p>
    <a href="${publicUrl}" style="background:#0077b6;color:white;padding:12px 24px;
       text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px">
      Voir et réserver →
    </a>
  </p>
  <hr style="margin-top:30px">
  <small style="color:#888">Tu reçois cet email car tu fais partie des amis de Wael Ridene.
  Visite <a href="${publicUrl}">${publicUrl}</a> pour gérer tes notifications.</small>
</body>
</html>`;
}

async function sendEmailNotifications(catchRow, items) {
  if (!process.env.SMTP_HOST) {
    console.warn('[notify] SMTP not configured, skipping email notifications');
    return;
  }
  const friends = db.prepare('SELECT * FROM friends WHERE email IS NOT NULL AND email != ""').all();
  if (!friends.length) return;

  const transporter = createTransport();
  const html = buildEmailHtml(catchRow, items);

  for (const friend of friends) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"FishCall 🎣" <${process.env.SMTP_USER}>`,
        to: friend.email,
        subject: `🎣 Nouvelle pêche disponible — ${catchRow.title}`,
        html,
      });
    } catch (err) {
      console.error(`[notify] Email failed for ${friend.email}:`, err.message);
    }
  }
}

async function sendPushNotifications(catchRow, items) {
  if (!process.env.VAPID_PUBLIC_KEY) {
    console.warn('[notify] VAPID keys not configured, skipping push notifications');
    return;
  }

  const friends = db.prepare(
    'SELECT * FROM friends WHERE push_subscription IS NOT NULL AND push_subscription != ""'
  ).all();
  if (!friends.length) return;

  const speciesList = items.map((i) => i.species).join(', ');
  const payload = JSON.stringify({
    title: '🎣 Nouvelle pêche disponible !',
    body: `${catchRow.title} — ${speciesList}`,
    url: process.env.PUBLIC_URL || '/',
  });

  for (const friend of friends) {
    try {
      const sub = JSON.parse(friend.push_subscription);
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      if (err.statusCode === 410) {
        // Subscription expired — remove it
        db.prepare('UPDATE friends SET push_subscription = NULL WHERE id = ?').run(friend.id);
        console.log(`[notify] Removed expired push subscription for friend #${friend.id}`);
      } else {
        console.error(`[notify] Push failed for friend #${friend.id}:`, err.message);
      }
    }
  }
}

async function notifyAll(catchRow, items) {
  await Promise.allSettled([
    sendEmailNotifications(catchRow, items),
    sendPushNotifications(catchRow, items),
  ]);
}

module.exports = { notifyAll };
