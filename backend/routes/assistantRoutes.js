const express = require('express');

const {
  createCustomAssistant,
  getDailyMessage,
  getMyAssistant,
  listAssistants,
  messageAssistant,
  rewriteTask,
  selectAssistant,
  updateAssistant
} = require('../controllers/assistantController');
const auth = require('../middleware/auth');
const createRateLimiter = require('../middleware/rateLimiter');

const router = express.Router();
const assistantLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: 'assistants'
});

router.use(auth);

router.get('/', listAssistants);
router.get('/me', getMyAssistant);
router.post('/select', assistantLimiter, selectAssistant);
router.post('/custom', assistantLimiter, createCustomAssistant);
router.patch('/me', assistantLimiter, updateAssistant);
router.post('/message', assistantLimiter, messageAssistant);
router.post('/rewrite-task', assistantLimiter, rewriteTask);
router.get('/daily', getDailyMessage);

module.exports = router;
