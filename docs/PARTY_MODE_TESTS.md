# Party Mode Tests Manuels

## Preparation

1. Demarrer le backend avec une base MongoDB disponible.
2. Ouvrir l'app frontend.
3. Creer ou utiliser deux comptes differents pour tester deux joueurs.
4. Verifier que les routes Todo existantes fonctionnent encore avant de tester Party Mode.

## Creer une room

1. Se connecter.
2. Ouvrir `Party Mode`.
3. Renseigner un nom de salle, un pseudo, un avatar, `maxPlayers` et le timer.
4. Cliquer `Creer la salle`.
5. Verifier:
   - un code de room apparait.
   - le createur est hote.
   - le createur est dans la liste joueurs.
   - la room apparait dans les rooms recentes.
   - MongoDB Atlas contient un document `gamerooms` et un document `players`.

## Rejoindre une room

1. Copier le code depuis le compte hote.
2. Se connecter avec un deuxieme compte dans un autre navigateur ou profil.
3. Ouvrir `Party Mode`.
4. Entrer le code, choisir pseudo et avatar.
5. Cliquer `Entrer dans la salle`.
6. Verifier:
   - le deuxieme joueur apparait chez les deux utilisateurs apres polling.
   - le deuxieme joueur n'est pas hote.
   - un message systeme indique l'arrivee.

## Creer joueurs et ready

1. Dans chaque session, cliquer `Pret`.
2. Verifier:
   - le statut passe a `pret`.
   - recliquer remet `pas pret`.
   - le bouton fonctionne sans changer le score.

## Lancer Speed Todo

1. Cote hote, cliquer `Lancer Speed Todo`.
2. Verifier:
   - le statut room passe a `playing`.
   - le formulaire de reponses apparait.
   - le timer affiche le temps restant.
   - le bouton de lancement est masque ou desactive pendant la partie.

## Soumettre reponses

1. Chaque joueur saisit plusieurs lignes dans `Tes idees`.
2. Cliquer `Envoyer mes idees`.
3. Verifier:
   - chaque ligne devient une proposition.
   - maximum 10 idees sont prises.
   - les textes trop longs ou dangereux sont refuses.
   - un message de jeu indique l'envoi.

## Voter

1. Cote hote, cliquer `Passer au vote`.
2. Chaque joueur vote pour:
   - `Utile`
   - `Drole`
   - `Chaos`
3. Verifier:
   - l'auto-vote est desactive.
   - changer de vote dans une categorie remplace le vote precedent.
   - le polling affiche les votes sans rechargement complet.

## Calcul scores

1. Cote hote, cliquer `Calculer resultats`.
2. Verifier:
   - +1 par idee valide.
   - +3 pour le gagnant utile.
   - +3 pour le gagnant drole.
   - +2 pour le gagnant chaos.
   - les scores cumulés sont visibles dans le classement.
   - MongoDB Atlas contient un `gamesessions` termine et un `gamehistories`.

## Quitter room

1. Cliquer `Quitter`.
2. Verifier:
   - le joueur devient deconnecte ou sort de l'affichage actif apres polling.
   - si l'hote quitte, un autre joueur connecte devient hote.
   - si plus personne n'est connecte, la room passe `finished`.

## Verifier Atlas

Dans MongoDB Atlas Data Explorer, verifier les collections:

- `gamerooms`
- `players`
- `gamesessions`
- `gamehistories`
- `roommessages`

Verifier qu'aucun secret, token JWT ou refresh token n'est stocke dans ces collections.

## Tester mobile

1. Ouvrir l'app avec les devtools en largeur mobile.
2. Tester creation room, join, lobby, Speed Todo et votes.
3. Verifier:
   - aucun texte ne deborde des boutons.
   - les cartes restent lisibles.
   - le code de room est facile a copier.
   - le chat ne masque pas les actions de jeu.

## Mauvais code

1. Entrer un code inexistant comme `ZZZZZ`.
2. Cliquer `Entrer dans la salle`.
3. Verifier une erreur claire `Room not found`.

## Pseudo trop long

1. Entrer un pseudo de plus de 32 caracteres.
2. Creer ou rejoindre une room.
3. Verifier:
   - le front limite la saisie.
   - le backend refuse si la limite est contournee.

## Room inexistante via API

Appeler:

```powershell
Invoke-WebRequest -UseBasicParsing https://VOTRE_API/rooms/ABCDE -Headers @{Authorization="Bearer VOTRE_TOKEN"}
```

Verifier:

- status HTTP 404.
- message JSON `Room not found`.

## Regression TodoFlow

1. Revenir a `Dashboard Todo`.
2. Creer une tache.
3. Modifier une tache.
4. Supprimer une tache.
5. Tester l'assistant local.
6. Verifier que le mode offline et le service worker ne bloquent pas `party.js`.
