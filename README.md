# 🎣 FishCall

Application web PWA de partage de prises de pêche entre amis.  
Hamdène publie ses prises, ses ~30 amis réservent en ligne.

---

## Démarrage local (développement)

### Prérequis
- Node.js ≥ 18
- `npm`

### Lancement en une commande

```bash
./start-local.sh
```

Ce script :
1. Crée `.env` depuis `.env.example` si absent
2. Crée les dossiers `data/`, `public/uploads/`, `logs/`
3. Installe les dépendances si besoin
4. Lance le serveur avec rechargement automatique (`node --watch`)

**URLs :**
| Page | URL |
|------|-----|
| Page publique (amis) | http://localhost:3000 |
| Dashboard admin | http://localhost:3000/admin.html |

**Mot de passe admin par défaut :** `fishcall2024`

---

## Configuration `.env`

Copier `.env.example` → `.env` et remplir :

```env
# Obligatoire
JWT_SECRET=une-chaine-aleatoire-longue-et-secrete
ADMIN_PASSWORD=ton-mot-de-passe-admin

# URL publique (affichée dans les emails)
PUBLIC_URL=https://fishcall.tondomaine.tn

# SMTP (pour les emails de notification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ton-email@gmail.com
SMTP_PASS=ton-app-password-gmail
SMTP_FROM="FishCall 🎣 <ton-email@gmail.com>"

# Web Push (pour les notifs push mobiles)
# Générer avec : npm run generate-vapid
VAPID_SUBJECT=mailto:ton-email@gmail.com
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### Générer les clés VAPID (push notifications)

```bash
npm run generate-vapid
```

Copier les deux clés dans `.env`.

---

## Déploiement sur VPS OVH

### 1. Prérequis sur le VPS

```bash
# Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Git
apt install -y git
```

### 2. Premier déploiement

```bash
# Cloner le repo
git clone https://github.com/abdelfattehsakkat/pecheru.git /var/www/fishcall
cd /var/www/fishcall

# Créer et remplir le .env
cp .env.example .env
nano .env   # remplir JWT_SECRET, ADMIN_PASSWORD, SMTP, VAPID, PUBLIC_URL

# Lancer
docker compose up -d --build
```

### 3. Déploiements suivants (mise à jour)

```bash
cd /var/www/fishcall
./deploy.sh
```

Ce script fait `git pull` puis `docker compose up -d --build`.

### 4. Nginx reverse proxy (recommandé)

```nginx
# /etc/nginx/sites-available/fishcall
server {
    listen 80;
    server_name fishcall.tondomaine.tn;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 15M;  # pour les uploads photos
}
```

```bash
ln -s /etc/nginx/sites-available/fishcall /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL avec Let's Encrypt
certbot --nginx -d fishcall.tondomaine.tn
```

### 5. Variables à mettre à jour pour la production

| Variable | Valeur |
|----------|--------|
| `PUBLIC_URL` | `https://fishcall.tondomaine.tn` |
| `JWT_SECRET` | Chaîne aléatoire ≥ 32 caractères |
| `ADMIN_PASSWORD` | Ton vrai mot de passe |
| `NODE_ENV` | `production` |
| `SMTP_*` | Tes credentials SMTP |
| `VAPID_*` | Clés générées avec `npm run generate-vapid` |

---

## Partager le lien avec les amis

Une fois sur le VPS avec SSL :

```
https://fishcall.tondomaine.tn
```

Les amis peuvent :
- Ouvrir le lien depuis leur téléphone
- **Installer l'appli** (bouton "Ajouter à l'écran d'accueil" sur iOS/Android)
- Activer les **notifications push** depuis la page → ils seront avertis à chaque nouvelle pêche

Pour tester en local avec un ami sur le même WiFi, utilise ton IP locale :
```
http://192.168.1.X:3000
```

---

## Commandes utiles

```bash
npm start                  # démarrer en production
node --watch server.js     # démarrer avec hot-reload (dev)
npm run generate-vapid     # générer les clés VAPID

docker compose logs -f     # voir les logs en temps réel
docker compose ps          # état des conteneurs
docker compose down        # arrêter
```

