# FishCall — Contexte projet pour l'IA

## Vue d'ensemble
Application web PWA de partage de prises de pêche entre amis.
- **Utilisateur principal :** Hamdène (pêcheur amateur, unique admin)
- **Utilisateurs secondaires :** ~20-30 amis qui réservent du poisson
- **Objectif :** remplacer un groupe WhatsApp chaotique

## Stack technique
| Composant | Technologie |
|-----------|------------|
| Runtime | Node.js (>=18) |
| Framework | Fastify |
| Base de données | SQLite via better-sqlite3 |
| Frontend | HTML/CSS/JS vanilla |
| Notifications | Web Push (VAPID) + Email (Nodemailer) |
| Auth | JWT signé, stocké en cookie httpOnly |
| PWA | manifest.json + service worker |
| Déploiement | PM2 sur VPS OVH + Nginx reverse proxy |
| Containerisation | Docker + docker-compose |
| CI | GitHub Actions (build image uniquement) |

## Structure des fichiers
```
fishcall/
├── server.js              # Point d'entrée Fastify
├── db.js                  # Init SQLite + migrations auto
├── routes/
│   ├── admin.js           # Routes dashboard (protégées JWT)
│   ├── public.js          # Routes page publique (sans auth)
│   └── push.js            # Gestion subscriptions Web Push
├── services/
│   ├── auth.js            # Hash/verify password (HMAC-SHA256)
│   ├── stock.js           # Logique réservation + transaction SQLite
│   └── notify.js          # Email (Nodemailer) + Web Push
├── public/
│   ├── index.html         # Page amis (PWA, polling stock)
│   ├── admin.html         # Dashboard pêcheur (SPA vanilla)
│   ├── sw.js              # Service Worker
│   ├── manifest.json      # PWA manifest
│   ├── style.css          # CSS commun responsive mobile-first
│   └── uploads/           # Photos uploadées (ignorées par git)
├── .env.example           # Template variables d'environnement
├── ecosystem.config.js    # Config PM2
├── Dockerfile             # Image de production
└── docker-compose.yml     # Stack complète
```

## Modèle de données
- **friends** : amis avec nom, téléphone, email, push_subscription JSON
- **catches** : session de pêche (draft → published → archived)
- **fish_items** : espèces dans une pêche avec stock total/restant
- **reservations** : réservations actives/annulées

## Règles métier critiques
- `remaining` est la source de vérité pour le stock
- Les réservations utilisent une transaction SQLite atomique :
  `UPDATE fish_items SET remaining = remaining - ? WHERE id = ? AND remaining >= ?`
- Si `changes === 0` → retourner 409 (stock insuffisant)
- `remaining` ne peut jamais être négatif

## Variables d'environnement requises
```
PORT, NODE_ENV, PUBLIC_URL
JWT_SECRET          # Secret fort pour signer les JWT
ADMIN_PASSWORD      # Mot de passe admin en clair (dev) ou
ADMIN_PASSWORD_HASH # Hash HMAC-SHA256 (production)
DB_DIR              # Répertoire de la base SQLite
UPLOADS_DIR         # Répertoire des uploads
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```

## Patterns à respecter
- Toujours valider les inputs côté serveur (schemas Fastify)
- Ne jamais retourner de stack trace en production
- Les routes admin protégées sont dans un child scope Fastify avec `addHook('preHandler', authenticate)`
- Login/logout sont dans le scope parent (pas protégés)
- Uploads : validation extension + pipeline stream (pas de readFile)

## Ce qui N'est PAS dans le périmètre
- Pas de paiement
- Pas de multi-utilisateurs admin
- Pas de WebSocket (polling toutes les 10s suffit)
- Pas de framework frontend (React, Vue, etc.)
- Pas de compte pour les amis
