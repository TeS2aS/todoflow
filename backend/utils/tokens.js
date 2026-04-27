const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function parseDuration(value, fallbackMs) {
  if (!value) {
    return fallbackMs;
  }

  const match = String(value).trim().match(/^(\d+)(ms|s|m|h|d)$/);

  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

function createAccessToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment variables');
  }

  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function getRefreshTokenExpiryDate() {
  const durationMs = parseDuration(
    process.env.JWT_REFRESH_EXPIRES_IN,
    7 * 24 * 60 * 60 * 1000
  );

  return new Date(Date.now() + durationMs);
}

function createPasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getPasswordResetExpiryDate() {
  return new Date(Date.now() + 15 * 60 * 1000);
}

module.exports = {
  createAccessToken,
  createPasswordResetToken,
  createRefreshToken,
  getPasswordResetExpiryDate,
  getRefreshTokenExpiryDate,
  hashToken
};
