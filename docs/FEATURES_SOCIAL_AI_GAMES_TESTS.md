# TodoFlow Social AI Games V1 - Tests manuels

## Reset password

1. Configurer SMTP sur le backend: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `RESET_PASSWORD_URL`.
2. Ouvrir l'app, cliquer `Mot de passe oublie`, saisir un email existant.
3. Verifier que la reponse UI reste generique et ne dit pas si le compte existe.
4. Verifier que l'email est recu.
5. Ouvrir le lien recu vers `reset-password.html?token=...`.
6. Saisir un nouveau mot de passe avec majuscule, minuscule et chiffre.
7. Valider, puis se connecter avec le nouveau mot de passe.
8. Reutiliser le meme lien: il doit etre refuse.
9. Demander un reset et attendre plus de 15 minutes: le token doit etre expire.

## Assistant

1. Aller dans `Assistant`.
2. Choisir `Mambo`, revenir au dashboard et verifier le badge assistant.
3. Choisir `Kratos`, tester une reformulation.
4. Creer un assistant custom avec nom, couleur, ton, objectifs, phrases favorites et intensite.
5. Cliquer `Tester`, verifier un message personnalise.
6. Cliquer `Reformuler`, verifier une reformulation selon le style.
7. Cliquer `Message du jour`.
8. Verifier en MongoDB la collection `assistantprofiles`.

## Chat

1. Aller dans `Chat`.
2. Envoyer un message texte.
3. Envoyer un lien `https://example.com` et verifier le lien cliquable.
4. Envoyer un emoji dans un message texte.
5. Choisir `Image URL` et envoyer une URL `.png`, `.jpg`, `.jpeg`, `.webp` ou `.gif`.
6. Choisir `GIF URL` et envoyer une URL `.gif`, Giphy ou Tenor.
7. Cliquer sur plusieurs reactions emoji.
8. Supprimer son propre message.
9. Tenter un message contenant du HTML ou `javascript:`: il doit etre refuse.

## Groupes

1. Aller dans `Groupes`.
2. Creer un groupe avec nom, description et photo par URL.
3. Modifier la photo du groupe.
4. Inviter un utilisateur par email et noter le code d'invitation.
5. Depuis un autre compte, rejoindre via le code.
6. Verifier la liste des membres et les roles.
7. Envoyer un message texte dans le chat de groupe.
8. Envoyer une URL image/GIF dans le chat de groupe.
9. Quitter le groupe avec un membre non-owner.
10. Supprimer le groupe avec le owner.

## GameZone

1. Aller dans `GameZone`.
2. Creer une room Speed Tasks Battle avec un theme.
3. Copier le code de room.
4. Depuis un autre compte, rejoindre la room.
5. Cliquer `Pret` avec les joueurs.
6. L'hote clique `Lancer`.
7. Pendant les 60 secondes, soumettre plusieurs idees.
8. Attendre le passage en phase `voting` via polling.
9. Voter pour `Drole`, `Utile` et `Chaos`.
10. L'hote clique `Resultats`.
11. Verifier classement, gagnant et badge.
12. Verifier en MongoDB les collections `gamerooms`, `gameplayers`, `gamesubmissions` et `gamevotes`.

## Checks techniques

```powershell
cd backend
npm install
node --check server.js
node --check services/authService.js
node --check services/emailService.js
node --check services/assistantService.js
node --check services/chatService.js
node --check services/groupService.js
node --check services/gameService.js
cd ..
node --check frontend/app.js
node --check frontend/social.js
node --check frontend/reset-password.js
```
