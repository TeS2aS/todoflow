# Party Mode Spec

## Nom retenu

Le nom retenu est **PartyFlow**.

Pourquoi:

- Il garde la continuite de TodoFlow avec le mot "Flow".
- Il annonce clairement une experience sociale et festive.
- Il reste assez large pour couvrir des rooms, des mini-jeux, des missions, des votes et un classement.
- Il sonne plus produit que TodoParty, plus accessible que TaskArena, et moins generique que FlowParty.

## Vision produit

PartyFlow transforme TodoFlow en plateforme de jeu social leger. L'utilisateur ne vient plus seulement terminer des taches: il cree une salle privee, invite des amis avec un code, choisit un pseudo, joue des manches rapides, gagne des points et repart avec des missions absurdes ou utiles.

La promesse V1: etre fun en moins de 30 secondes.

Parcours cible:

1. L'utilisateur se connecte a TodoFlow.
2. Il ouvre Party Mode.
3. Il cree une room avec un nom, un pseudo, un avatar et des settings simples.
4. Ses amis rejoignent avec le code.
5. L'hote lance Speed Todo.
6. Les joueurs ecrivent des taches utiles ou absurdes.
7. Les joueurs votent pour les meilleures propositions.
8. PartyFlow affiche scores, gagnant, phrase drole et classement.

## Architecture

### V1

La V1 utilise REST + polling toutes les 2 a 3 secondes.

Raisons:

- Aucun changement d'infrastructure Render/Vercel.
- Pas de nouvelle dependance runtime.
- Debogage plus simple.
- Le modele de donnees et les routes restent compatibles avec une future couche Socket.IO.

Le polling lit `GET /rooms/:code` et recupere:

- room
- players
- current session
- messages courts
- historique recent
- currentPlayerId

### V2 temps reel

Socket.IO pourra etre ajoute sans remplacer les routes REST. Les evenements prevus:

- `room:create`
- `room:join`
- `room:leave`
- `room:state`
- `game:start`
- `game:submit`
- `game:vote`
- `game:endRound`
- `chat:message`

Les routes REST restent le fallback officiel si WebSocket est indisponible.

## Mini-jeux

### 1. Task Battle

Chaque joueur propose une mini-mission drole. Les autres votent pour la mission la plus drole ou audacieuse.

Points:

- +3 pour la mission gagnante.
- +1 par vote recu.
- Bonus humour si l'hote active chaos mode.

### 2. Qui ferait ca ?

PartyFlow affiche une situation comme: "Qui oublierait son mot de passe trois fois dans la meme heure ?"

Les joueurs votent pour un ami.

Points:

- +1 si le joueur vote avec la majorite.
- Badge pour la personne la plus votee.

### 3. Speed Todo

Pendant 30, 60 ou 90 secondes, chaque joueur ecrit le plus de taches utiles ou absurdes possible.

Phase 1: collecte.

- Chaque ligne devient une proposition.
- Maximum 10 propositions par joueur.
- Chaque proposition valide donne +1.

Phase 2: vote.

- Vote "utile": +3 au gagnant.
- Vote "drole": +3 au gagnant.
- Vote "chaos": +2 au gagnant.
- Les auto-votes sont refuses.

Fallback solo:

- Un joueur seul peut lancer la manche.
- Sans votes, le score de base est conserve.

### 4. Imposteur de tache

Tous les joueurs recoivent un theme sauf un imposteur. Chacun ecrit une tache liee au theme.

Points:

- L'imposteur gagne s'il n'est pas trouve.
- Les autres gagnent s'ils trouvent l'imposteur.

### 5. Defi Roulette

Une roue choisit une categorie:

- productivite
- humour
- verite soft
- mini-defi
- creativite

Chaque joueur recoit un defi. Les autres valident ou refusent.

### 6. Vote du chaos

Les joueurs proposent une regle absurde pour la prochaine manche:

- ecrire uniquement en emojis
- doubler les points du dernier
- inverser les votes
- parler comme un pirate

L'hote active une regle.

### 7. Bingo de soiree

Chaque joueur a une grille d'evenements. Les amis valident quand un evenement arrive.

Exemples:

- quelqu'un dit "j'ai faim"
- quelqu'un cherche son chargeur
- quelqu'un parle trop fort

## Modeles MongoDB

### GameRoom

- `code`: code public court, unique.
- `name`: nom de la salle.
- `hostUserId`: proprietaire connecte.
- `status`: `lobby`, `playing`, `finished`.
- `currentGame`: mini-jeu actif.
- `currentRound`: numero de manche.
- `settings`: maxPlayers, roundDuration, allowAnonymousPlayers, enableChat, familyFriendlyMode, chaosMode.
- timestamps.

### Player

- `roomId`
- `userId` optionnel dans le modele, utilise en V1 pour les utilisateurs connectes.
- `nickname`
- `avatar`
- `score`
- `isHost`
- `isReady`
- `connected`
- `lastSeen`

### GameSession

- `roomId`
- `gameType`
- `status`: `waiting`, `collecting`, `voting`, `finished`.
- `round`
- `prompts`
- `submissions`
- `votes`
- `scores`
- `startedAt`
- `endedAt`

### GameHistory

- `roomId`
- `winners`
- `finalScores`
- `funnySummary`
- timestamps.

### RoomMessage

- `roomId`
- `playerId`
- `message`
- `type`: `system`, `user`, `game`
- timestamps.

## Routes REST

Rooms:

- `POST /rooms`
- `POST /rooms/join`
- `GET /rooms/:code`
- `POST /rooms/:code/leave`
- `POST /rooms/:code/ready`
- `POST /rooms/:code/start`

Games:

- `GET /games`
- `POST /rooms/:code/games/start`
- `POST /rooms/:code/games/submit`
- `POST /rooms/:code/games/vote`
- `POST /rooms/:code/games/end-round`
- `POST /rooms/:code/games/lobby` (helper V1 pour revenir au lobby apres les resultats)

Scores:

- `GET /rooms/:code/scores`
- `GET /rooms/:code/history`

Chat:

- `GET /rooms/:code/messages`
- `POST /rooms/:code/messages`

## UX

Navigation connectee:

- Dashboard Todo
- Party Mode
- Rooms
- Mini-jeux
- Historique

Party Mode:

- creer une salle
- rejoindre avec un code
- choisir pseudo et avatar
- voir les rooms recentes

Lobby:

- code tres visible
- bouton copier
- liste joueurs
- pret / pas pret
- choix Speed Todo V1
- messages systeme et chat court si active

Game:

- nom du jeu
- regles courtes
- timer
- zone de reponse
- votes
- scores live

Resultats:

- gagnant
- classement
- phrase drole locale
- badges textuels
- rejouer
- retour lobby

## Ton et messages

Messages possibles:

- "Le chaos est en cours de chargement..."
- "Quelqu'un va regretter ce vote."
- "Le serveur a survecu. Pas sur pour vos amities."
- "Mission acceptee. Dignite non garantie."
- "Le classement est injuste, mais officiel."

Badges:

- Roi du chaos
- Stratege douteux
- Genie incompris
- Champion du clic
- Victime du vote
- Imposteur professionnel
- Productif par accident

Avatars V1:

- choix emoji parmi une liste limitee.

## Securite

Mesures V1:

- routes Party protegees par JWT.
- validation stricte des pseudos, noms de room, messages et propositions.
- rejet des cles Mongo dangereuses deja global.
- rate limiting sur creation/join de rooms et messages.
- code de room aleatoire et unique.
- limite joueurs par room: 2 a 12.
- limite messages et taille message.
- pas de HTML brut injecte cote front; rendu via `textContent`.
- CORS conserve via `CLIENT_URL` / `CLIENT_URLS`.

Mesures futures:

- nettoyage periodique des rooms inactives.
- tokens anonymes signes pour joueurs invites sans compte.
- audit anti-spam par room.

## Plan V1

- Modeles MongoDB: GameRoom, Player, GameSession, GameHistory, RoomMessage.
- Routes REST rooms/games/messages.
- Party Mode dans le front sans casser Dashboard Todo.
- Creation et jonction de room.
- Lobby avec joueurs, ready, code et settings.
- Speed Todo complet: collecte, vote, scoring, resultats.
- Polling de room state.
- Stockage Atlas via Mongoose.
- Documentation et tests manuels.

## Plan V2

- Socket.IO avec fallback polling.
- Chat temps reel.
- Task Battle, Qui ferait ca, Defi Roulette.
- Badges persistants.
- Confettis.
- Sons avec bouton mute.
- Historique complet des parties.

## Plan V3

- matchmaking public.
- profils joueurs.
- amis et invitations.
- statistiques globales.
- achievements.
- generation assistee de defis.
