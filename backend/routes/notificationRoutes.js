const express = require('express');

const auth = require('../middleware/auth');
const { getConfig, subscribe } = require('../controllers/notificationController');

const router = express.Router();

router.use(auth);
router.get('/config', getConfig);
router.post('/subscribe', subscribe);

module.exports = router;
