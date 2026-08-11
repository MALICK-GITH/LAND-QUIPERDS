# Guide d'installation — SKILL2CASH

Application **TanStack Start (React 19) + PostgreSQL (Supabase)**.
Elle est **100 % portable** : aucun verrou d'hôte, de domaine ou de plateforme.
Tu peux l'héberger sur un VPS, Docker, Node, Cloudflare Workers, Vercel, Render…

---

## 1. Prérequis

- **Node.js 20+** (ou **Bun 1.1+**, plus rapide)
- Un projet **PostgreSQL avec Supabase** (cloud ou auto-hébergé) pour l'auth, le
  temps réel et le stockage des captures.

## 2. Installation

```bash
git clone <url-du-depot> skill2cash
cd skill2cash

# avec bun (recommandé)
bun install

# ou avec npm
npm install
```

## 3. Variables d'environnement

```bash
cp .env.example .env
```

Puis renseigne :

| Variable | Rôle |
| --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | URL de l'API PostgreSQL/Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | clé publique (navigateur + SSR) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé de service, serveur uniquement |
| `APP_BASE_URL` | URL publique du site, utilisée pour les liens et le webhook Telegram |
| `TELEGRAM_BOT_TOKEN` | token du bot Telegram officiel |
| `LOVABLE_API_KEY` | assistant IA (facultatif) |
| `DISABLE_CSRF` | `true` si le front et l'API sont sur deux domaines |
| `PORT` | port d'écoute en production (défaut `3000`) |

## 4. Base de données

Applique les migrations SQL dans l'ordre :

```bash
# via la CLI Supabase
supabase db push

# ou manuellement
psql "$DATABASE_URL" -f supabase/migrations/<fichier>.sql
```

Ensuite, dans la configuration Auth du projet :

1. Active le provider **Email/Mot de passe** (et **Google** si souhaité).
2. Renseigne la **Site URL** et les **Redirect URLs** avec ton domaine
   (`https://mondomaine.com`, `https://mondomaine.com/auth`).
3. Crée un bucket de stockage **privé** nommé `chat-evidence` (les politiques RLS
   sont déjà incluses dans les migrations).
4. Configure `APP_BASE_URL` et `TELEGRAM_BOT_TOKEN` sur ton hébergement pour que
   le bot puisse enregistrer automatiquement son webhook vers
   `/api/public/telegram/webhook`.

Les comptes administrateurs sont attribués automatiquement à l'inscription pour
`onexdelux@gmail.com` (voir la fonction `handle_new_user`). Modifie cette liste
dans une migration pour tes propres adresses.

## 5. Lancer en développement

```bash
bun run dev        # ou npm run dev
```

→ http://localhost:8080

## 6. Build et production

```bash
bun run build      # génère .output/
node .output/server/index.mjs
```

Avec un gestionnaire de process :

```bash
pm2 start .output/server/index.mjs --name skill2cash
```

### Docker

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

```bash
docker build -t skill2cash .
docker run -p 3000:3000 --env-file .env skill2cash
```

### Reverse-proxy Nginx

```nginx
server {
  server_name mondomaine.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> Les en-têtes `Upgrade`/`Connection` sont indispensables : le temps réel
> (messages, duels, notifications) utilise des WebSockets.

## 7. Notifications

Le service worker `public/sw.js` doit être servi à la racine du domaine et
**en HTTPS** (ou sur `localhost`). Il gère :

- les alertes système déclenchées par le temps réel (messages, défis, duels,
  dépôts/retraits), même quand l'onglet est en arrière-plan ;
- les notifications **Web Push** si tu branches un serveur push VAPID
  (l'écouteur `push` est déjà prêt dans `public/sw.js`).

L'utilisateur active les alertes depuis la cloche 🔔 dans l'en-tête.

## 8. Portabilité — ce qui a été retiré

- Aucun `allowedHosts` restrictif : n'importe quel domaine est accepté.
- CORS ouvert sur le serveur de dev et de preview.
- Protection CSRF désactivable via `DISABLE_CSRF=true`.
- Aucune dépendance à une plateforme d'hébergement particulière.

## 9. Dépannage

| Symptôme | Cause probable |
| --- | --- |
| Écran blanc / `Missing Supabase environment variable` | `.env` absent ou variables `VITE_*` manquantes au moment du **build** |
| Temps réel muet | WebSockets bloqués par le proxy (voir Nginx) |
| Notifications absentes | site non servi en HTTPS ou permission refusée |
| Erreur CSRF sur les actions | front et API sur deux domaines → `DISABLE_CSRF=true` |
| Redirection en boucle vers `/auth` | Site URL / Redirect URLs mal configurées dans Auth |
