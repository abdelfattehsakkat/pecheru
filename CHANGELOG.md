# Changelog

All notable changes to FishCall will be documented in this file.

## [0.1.0] — MVP Initial — 2026-05-24

### Added
- **Backend Fastify** avec SQLite (better-sqlite3)
  - Migrations automatiques au démarrage (`db.js`)
  - Tables : `friends`, `catches`, `fish_items`, `reservations`
- **Auth admin** : mot de passe unique, JWT signé en cookie httpOnly
- **Routes publiques** (`/api/catch/current`, `/api/reserve`, `/api/catch/:id/stock`)
- **Routes admin protégées** (CRUD pêches, espèces, amis, réservations)
- **Gestion du stock** : transaction SQLite atomique, protection race condition
- **Service de notifications** : Email (Nodemailer) + Web Push (VAPID)
- **Upload de photos** : multipart/form-data, validation extension
- **Frontend page publique** (`index.html`) : responsive, PWA, polling stock 10s
- **Dashboard admin** (`admin.html`) : SPA vanilla, toutes les fonctionnalités
- **CSS mobile-first** : palette marine, responsive sans framework CSS
- **PWA** : `manifest.json` + Service Worker (cache offline + push notifications)
- **PM2** : `ecosystem.config.js` pour déploiement production
- **Docker** : `Dockerfile` + `docker-compose.yml`
- **CI GitHub Actions** : build & push image Docker

### Testé
- ✅ Login/logout avec mauvais et bon mot de passe
- ✅ Création/publication d'une pêche
- ✅ Ajout d'espèces avec stock
- ✅ Réservation avec déduction atomique du stock
- ✅ Protection contre la sur-réservation (409 Conflict)
- ✅ Routes admin protégées (401 sans cookie)
