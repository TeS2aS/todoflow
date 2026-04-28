const express = require('express');

const {
  createMessage,
  deleteMessage,
  getMessages,
  toggleReaction
} = require('../controllers/chatController');
const auth = require('../middleware/auth');
const createRateLimiter = require('../middleware/rateLimiter');

const router = express.Router();
const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 35,
  keyPrefix: 'chat-messages'
});

router.use(auth);

router.get('/messages', getMessages);
router.post('/messages', chatLimiter, createMessage);
router.delete('/messages/:id', chatLimiter, deleteMessage);
router.post('/messages/:id/reactions', chatLimiter, toggleReaction);

module.exports = router;
