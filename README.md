# TodoFlow SaaS Todo App

Application full-stack de gestion de taches avec API Express/MongoDB, JWT, refresh tokens, dashboard moderne, mode offline, reset password SMTP, assistants personnalisables, chat, groupes prives et GameZone V1.

## Stack

- Backend: Node.js, Express, MongoDB, Mongoose
- Securite: Helmet, CORS strict, rate limiting memoire, validation stricte, erreurs centralisees
- Authentification: JWT court, refresh token hache, bcrypt, reset password reel par SMTP
- Frontend: HTML, CSS, JavaScript sans dependance externe
- Offline: Service Worker + cache localStorage + file d'attente de synchronisation

## Structure

```text
backend/
  config/
  controllers/
  middleware/
  models/
  routes/
  services/
  utils/
  .env.example
  package.json
  server.js
frontend/
  app.js
  index.html
  styles.css
  sw.js
```

## Fonctionnalites principales

- Auth avancee: access token, refresh token, expiration automatique, logout et reset password SMTP avec token hache et expiration 15 minutes.
- Securite API: Helmet, CORS limite, rate limiting global et auth, rejet des cles Mongo dangereuses, validation stricte des payloads.
- Taches enrichies: priorite, date limite, categorie, tags, sous-taches, notes, ordre manuel et historique des modifications.
- Performance: pagination, limites de page, indexes MongoDB orientes utilisateur/statut/priorite/date, requetes `lean` pour les listes.
- Dashboard: total, terminees, productivite, retard, barres de progression et filtres avances.
- UX: edition inline auto-save, drag and drop, confirmation suppression, toasts, loading state, responsive mobile et dark mode.
- Assistants: Mambo, Kratos et custom avec suggestions, reformulation, priorisation heuristique et analyse d'habitudes sans appel externe.
- Social V1: chat general, groupes prives, invitations par code/email et chat de groupe.
- GameZone V1: Speed Tasks Battle en REST avec polling, votes et classement.
- Notifications: notifications locales navigateur et routes preparees pour push Web Push.
- Bonus: themes clair/sombre, export JSON, service worker, cache offline et synchronisation au retour online.

## Routes API

Routes publiques:

- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `POST /forgot-password`
- `POST /reset-password`

Routes protegees par JWT:

- `GET /tasks?page=1&limit=20&filter=all&priority=high&due=today&search=...`
- `GET /tasks/stats`
- `GET /tasks/export`
- `POST /tasks`
- `PUT /tasks/:id`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `POST /tasks/reorder`
- `POST /tasks/ai/assistant`
- `GET /tasks/ai/analysis`
- `GET /notifications/config`
- `POST /notifications/subscribe`
- `GET /assistants`
- `GET /assistants/me`
- `POST /assistants/select`
- `POST /assistants/custom`
- `PATCH /assistants/me`
- `POST /assistants/message`
- `POST /assistants/rewrite-task`
- `GET /assistants/daily`
- `GET /chat/messages`
- `POST /chat/messages`
- `DELETE /chat/messages/:id`
- `POST /chat/messages/:id/reactions`
- `POST /groups`
- `GET /groups`
- `GET /groups/:id`
- `PATCH /groups/:id`
- `DELETE /groups/:id`
- `POST /groups/:id/invite`
- `POST /groups/join`
- `GET /groups/:id/members`
- `PATCH /groups/:id/members/:userId`
- `DELETE /groups/:id/members/:userId`
- `GET /groups/:id/messages`
- `POST /groups/:id/messages`
- `POST /game/rooms`
- `POST /game/rooms/join`
- `GET /game/rooms/:code`
- `POST /game/rooms/:code/ready`
- `POST /game/rooms/:code/start`
- `POST /game/rooms/:code/submissions`
- `GET /game/rooms/:code/submissions`
- `POST /game/rooms/:code/votes`
- `GET /game/rooms/:code/results`
- `POST /game/rooms/:code/finish`

Le token d'acces doit etre envoye avec:

```http
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

## Installation

1. Installer les dependances backend:

```bash
cd backend
npm install
```

2. Creer le fichier `.env`:

```powershell
Copy-Item .env.example .env
```

3. Modifier `.env` si besoin:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/todo_app
JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
MONGO_CONNECT_RETRIES=3
MONGO_CONNECT_RETRY_DELAY_MS=2000
VAPID_PUBLIC_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
RESET_PASSWORD_URL=https://todoflow-alpha.vercel.app/reset-password.html
GIPHY_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

4. Lancer MongoDB localement.

5. Demarrer le serveur:

```bash
npm run dev
```

Ou en mode production:

```bash
npm start
```

6. Ouvrir l'application:

```text
http://localhost:5000
```

## Reset password SMTP

Le reset password utilise Nodemailer en SMTP. Le backend genere un token aleatoire, stocke uniquement son hash SHA-256 en base, expire le token apres 15 minutes, puis envoie un lien vers `RESET_PASSWORD_URL`.

Variables requises pour un envoi reel:

```env
SMTP_HOST=smtp.votre-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre_user
SMTP_PASS=votre_mot_de_passe_ou_app_password
EMAIL_FROM=TodoFlow <no-reply@votre-domaine.com>
RESET_PASSWORD_URL=https://todoflow-alpha.vercel.app/reset-password.html
```

En developpement, si SMTP n'est pas configure, le serveur affiche un warning clair et ne crash pas. La reponse reste generique pour ne pas reveler si l'email existe. En production, configurez SMTP sur Render avant de promettre le reset password aux utilisateurs.

Test manuel rapide:

1. Cliquer `Mot de passe oublie`.
2. Saisir l'email du compte.
3. Ouvrir l'email recu.
4. Utiliser le lien `reset-password.html?token=...`.
5. Saisir un nouveau mot de passe avec majuscule, minuscule et chiffre.
6. Se reconnecter avec le nouveau mot de passe.
7. Reutiliser le lien: il doit etre refuse.

## Connexion MongoDB Atlas

Objectif: remplacer MongoDB local par une base cloud MongoDB Atlas gratuite.

1. Creer le cluster Atlas:

- Creer un compte sur https://www.mongodb.com/atlas.
- Creer un projet, puis un cluster gratuit `M0` / Free cluster.
- Choisir `AWS` comme provider et `us-east-1` comme region.
- Nom recommande pour le cluster: `todoflow-dev`.

2. Configurer la securite:

- Creer un database user dedie, par exemple `todoflow_app`.
- Generer un mot de passe fort et le conserver hors du depot.
- Dans Network Access, ajouter uniquement ton IP actuelle avec `Add My Current IP Address`.
- Eviter `0.0.0.0/0` sauf test temporaire: cette option autorise toute IP Internet a tenter une connexion.

3. Recuperer l'URI:

- Dans Atlas, ouvrir le cluster, cliquer `Connect`, puis `Drivers`.
- Choisir Node.js et copier l'URI `mongodb+srv://`.
- Remplacer `<password>` par le mot de passe du database user.
- Utiliser `todo_app` comme nom de base.

Exemple sans vrai secret:

```env
MONGO_URI=mongodb+srv://todoflow_app:<password>@<cluster-host>/todo_app?retryWrites=true&w=majority
```

Si le mot de passe contient `@`, `#`, `/`, `:` ou des espaces, encoder ces caracteres dans l'URI ou regenerer un mot de passe compatible URI.

4. Mettre a jour le backend:

- Ouvrir `backend/.env`.
- Remplacer uniquement la ligne `MONGO_URI=...` locale par l'URI Atlas.
- Ne pas copier la vraie URI dans `README.md`, `.env.example` ou un commit Git.

5. Verifier:

```powershell
cd backend
npm.cmd run dev
```

Le serveur doit afficher une connexion MongoDB avec URI masquee, puis:

```text
MongoDB connected to database "todo_app"
```

Sources officielles:

- https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/
- https://www.mongodb.com/docs/atlas/security/ip-access-list/
- https://www.mongodb.com/docs/atlas/driver-connection/
- https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/

## Deploiement cloud Render + Vercel

Architecture cible:

- Backend API sur Render: `https://todoflow-api.onrender.com`
- Frontend statique sur Vercel: `https://votre-projet.vercel.app`
- Base de donnees sur MongoDB Atlas
- CORS strict: le backend accepte seulement l'URL frontend configuree dans `CLIENT_URL` ou `CLIENT_URLS`.

### 1. Preparer Git et GitHub

Verifier que `.gitignore` contient bien:

```gitignore
node_modules/
.env
backend/.env
*.log
dist/
build/
```

Initialiser et pousser le depot:

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/VOTRE_USER/todoflow.git
git push -u origin main
```

Ne jamais pousser `backend/.env`. Utiliser uniquement les variables d'environnement Render/Vercel.

### 2. Deployer le backend sur Render

Option A, via l'interface Render:

- Aller sur https://render.com et creer un compte.
- Cliquer `New` puis `Web Service`.
- Connecter le repository GitHub.
- Configurer:
  - Root Directory: `backend`
  - Environment: `Node`
  - Build Command: `npm install`
  - Start Command: `npm start`
  - Health Check Path: `/health`

Variables Render a ajouter:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://todoflow_app:<password>@<cluster-host>/todo_app?retryWrites=true&w=majority
JWT_SECRET=un_secret_long_aleatoire
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=https://votre-projet.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
MONGO_CONNECT_RETRIES=3
MONGO_CONNECT_RETRY_DELAY_MS=2000
VAPID_PUBLIC_KEY=
SMTP_HOST=votre.smtp.host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre_user_smtp
SMTP_PASS=votre_secret_smtp
EMAIL_FROM=TodoFlow <no-reply@votre-domaine.com>
RESET_PASSWORD_URL=https://todoflow-alpha.vercel.app/reset-password.html
GIPHY_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Option B, via Blueprint:

- Le fichier `render.yaml` est fourni a la racine.
- Dans Render, choisir `Blueprint`, connecter le repo, puis renseigner les variables marquees secret.

Tester l'API Render:

```powershell
Invoke-WebRequest -UseBasicParsing https://todoflow-api.onrender.com/health
```

Reponse attendue:

```json
{"status":"ok"}
```

### 3. Deployer le frontend sur Vercel

Le frontend utilise `frontend/env.js`, genere par `frontend/scripts/write-env.js` pendant le build Vercel.

Dans Vercel:

- Importer le meme repository GitHub.
- Framework Preset: `Other`.
- Build Command: `cd frontend && npm run build`
- Install Command: `cd frontend && npm install`
- Output Directory: `frontend`
- Ajouter la variable d'environnement:

```env
API_URL=https://todoflow-api.onrender.com
```

Le fichier `vercel.json` configure deja ces commandes et met `env.js` en `Cache-Control: no-store`.

### 4. Connecter les deux services

Apres le premier deploy Vercel:

- Copier l'URL frontend finale, par exemple `https://todoflow.vercel.app`.
- Dans Render, modifier:

```env
CLIENT_URL=https://todoflow.vercel.app
RESET_PASSWORD_URL=https://todoflow.vercel.app/reset-password.html
```

- Redeployer Render.
- Dans Vercel, verifier que:

```env
API_URL=https://todoflow-api.onrender.com
```

- Redeployer Vercel si la variable a ete modifiee.
- Ne pas ajouter de slash final aux URL CORS. Pour le deploiement actuel de la capture, Render doit avoir `CLIENT_URL=https://todoflow-alpha.vercel.app` et Vercel doit avoir `API_URL=https://todoflow-qgy1.onrender.com`.

Pour plusieurs domaines frontend, utiliser:

```env
CLIENT_URLS=https://todoflow.vercel.app,https://www.votre-domaine.com
```

### 5. Tests cloud complets

- Ouvrir le frontend Vercel en HTTPS.
- Creer un compte.
- Se connecter.
- Creer, modifier, filtrer et supprimer des taches.
- Tester drag and drop.
- Couper le reseau, creer une tache offline, puis revenir online.
- Verifier dans MongoDB Atlas Data Explorer que les collections `users` et `tasks` recoivent les donnees.
- Tester une requete API directe:

```powershell
Invoke-WebRequest -UseBasicParsing https://todoflow-api.onrender.com/health
```

Si le frontend affiche un mode offline permanent:

- Verifier `API_URL` dans Vercel.
- Verifier `CLIENT_URL` dans Render.
- Verifier que MongoDB Atlas autorise les connexions Render. En dev, `0.0.0.0/0` peut depanner temporairement, mais il faut ensuite revenir a une regle plus stricte.

## Tests manuels conseilles

1. Creer un compte, se connecter, verifier que les tokens sont stockes et que les taches se chargent.
2. Creer une tache avec priorite, date limite, categorie, tags et notes.
3. Modifier le titre inline, changer la priorite, ajouter une sous-tache puis recharger la page.
4. Tester recherche, filtre statut, filtre priorite, filtre date et pagination.
5. Glisser-deposer une tache en mode "Ordre manuel".
6. Activer le dark mode, puis rafraichir pour verifier la persistance.
7. Couper le reseau, creer ou modifier une tache, puis revenir online pour verifier la synchronisation.
8. Cliquer sur "Notifications" et creer une tache avec echeance proche.
9. Tester "Mot de passe oublie" avec SMTP configure, recevoir l'email, ouvrir `reset-password.html`, changer le mot de passe puis verifier que le token ne peut pas etre reutilise.
10. Utiliser Mambo, Kratos puis un assistant custom pour suggerer, reformuler, prioriser et analyser le planning.
11. Tester le chat general: texte, lien, emoji, image URL, GIF URL, reaction et suppression.
12. Tester les groupes: creation, photo URL, invitation, join code, membres, chat groupe, quitter et supprimer.
13. Tester GameZone: creer room, rejoindre, ready, start, submit, vote, results.
14. Avec Atlas, verifier dans Data Explorer que `todo_app.users`, `tasks`, `assistantprofiles`, `chatmessages`, `groups`, `groupmembers`, `gamerooms`, `gameplayers`, `gamesubmissions` et `gamevotes` recoivent les donnees.
15. Tester une erreur reseau en retirant temporairement ton IP Atlas, puis verifier que les retries et le message d'erreur sont explicites.

## Verification syntaxique

Les fichiers JavaScript peuvent etre verifies avec:

```powershell
node --check backend/server.js
node --check backend/config/db.js
node --check backend/services/authService.js
node --check backend/services/emailService.js
node --check backend/services/assistantService.js
node --check backend/services/chatService.js
node --check backend/services/groupService.js
node --check backend/services/gameService.js
node --check backend/services/taskService.js
node --check frontend/app.js
node --check frontend/social.js
node --check frontend/reset-password.js
```

## Notes production

- Utiliser un `JWT_SECRET` long et aleatoire.
- Servir l'application en HTTPS pour notifications, service worker et push.
- Remplacer le rate limiter memoire par Redis si plusieurs instances backend.
- Persister les abonnements push dans une collection MongoDB dediee.
- Surveiller les erreurs SMTP et utiliser un fournisseur email fiable pour le reset password.
- Restreindre `CLIENT_URL` au domaine de production.
