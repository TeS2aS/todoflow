const express = require('express');

const {
  createMessage,
  createRoom,
  getHistory,
  getMessages,
  getRoom,
  getScores,
  joinRoom,
  leaveRoom,
  setReady,
  startRoom
} = require('../controllers/roomController');
const auth = require('../middleware/auth');
const createRateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

const roomWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 40,
  keyPrefix: 'rooms'
});
const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: 'room-messages'
});

router.use(auth);

router.post('/', roomWriteLimiter, createRoom);
router.post('/join', roomWriteLimiter, joinRoom);
router.get('/:code', getRoom);
router.post('/:code/leave', roomWriteLimiter, leaveRoom);
router.post('/:code/ready', roomWriteLimiter, setReady);
router.post('/:code/start', roomWriteLimiter, startRoom);
router.get('/:code/scores', getScores);
router.get('/:code/history', getHistory);
router.get('/:code/messages', getMessages);
router.post('/:code/messages', messageLimiter, createMessage);

module.exports = router;
