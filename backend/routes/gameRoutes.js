const express = require('express');

const {
  createBattleRoom,
  endRound,
  finishBattleRoom,
  getBattleResults,
  getBattleRoom,
  listGames,
  joinBattleRoom,
  listBattleSubmissions,
  resetToLobby,
  setBattleReady,
  startGame,
  startBattleRoom,
  submitBattleResponse,
  submitGame,
  voteBattleSubmission,
  voteGame
} = require('../controllers/gameController');
const auth = require('../middleware/auth');
const createRateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

const gameActionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 80,
  keyPrefix: 'games'
});

router.use(auth);

router.get('/games', listGames);
router.post('/game/rooms', gameActionLimiter, createBattleRoom);
router.post('/game/rooms/join', gameActionLimiter, joinBattleRoom);
router.get('/game/rooms/:code', getBattleRoom);
router.post('/game/rooms/:code/ready', gameActionLimiter, setBattleReady);
router.post('/game/rooms/:code/start', gameActionLimiter, startBattleRoom);
router.post('/game/rooms/:code/submissions', gameActionLimiter, submitBattleResponse);
router.get('/game/rooms/:code/submissions', listBattleSubmissions);
router.post('/game/rooms/:code/votes', gameActionLimiter, voteBattleSubmission);
router.get('/game/rooms/:code/results', getBattleResults);
router.post('/game/rooms/:code/finish', gameActionLimiter, finishBattleRoom);
router.post('/rooms/:code/games/start', gameActionLimiter, startGame);
router.post('/rooms/:code/games/submit', gameActionLimiter, submitGame);
router.post('/rooms/:code/games/vote', gameActionLimiter, voteGame);
router.post('/rooms/:code/games/end-round', gameActionLimiter, endRound);
router.post('/rooms/:code/games/lobby', gameActionLimiter, resetToLobby);

module.exports = router;
