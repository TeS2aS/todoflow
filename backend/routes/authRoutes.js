const express = require('express');

const {
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  resetPassword
} = require('../controllers/authController');
const createRateLimiter = require('../middleware/rateLimiter');

const router = express.Router();
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  keyPrefix: 'auth'
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;
