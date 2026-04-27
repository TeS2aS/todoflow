const bcrypt = require('bcryptjs');

const User = require('../models/User');
const ApiError = require('../utils/apiError');
const {
  createAccessToken,
  createPasswordResetToken,
  createRefreshToken,
  getPasswordResetExpiryDate,
  getRefreshTokenExpiryDate,
  hashToken
} = require('../utils/tokens');
const {
  normalizeEmail,
  validateAuthInput
} = require('../utils/validators');

const MAX_REFRESH_TOKENS = 5;

function toUserPayload(user) {
  return {
    id: user._id,
    email: user.email
  };
}

async function issueSession(user) {
  const accessToken = createAccessToken(user._id.toString());
  const refreshToken = createRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = getRefreshTokenExpiryDate();

  user.refreshTokens = [
    ...(user.refreshTokens || []).filter((item) => item.expiresAt > new Date()),
    { tokenHash, expiresAt }
  ].slice(-MAX_REFRESH_TOKENS);

  await user.save();

  return {
    accessToken,
    token: accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    user: toUserPayload(user)
  };
}

async function register({ email: rawEmail, password }) {
  const email = normalizeEmail(rawEmail);
  const errors = validateAuthInput(email, password);

  if (errors.length) {
    throw new ApiError(400, 'Invalid registration data', errors);
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, 'Email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({ email, password: hashedPassword });

  return issueSession(user);
}

async function login({ email: rawEmail, password }) {
  const email = normalizeEmail(rawEmail);
  const errors = validateAuthInput(email, password);

  if (errors.length) {
    throw new ApiError(400, 'Invalid login data', errors);
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  return issueSession(user);
}

async function refreshSession(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new ApiError(400, 'Refresh token is required');
  }

  const tokenHash = hashToken(refreshToken);
  const user = await User.findOne({
    refreshTokens: {
      $elemMatch: {
        tokenHash,
        expiresAt: { $gt: new Date() }
      }
    }
  });

  if (!user) {
    throw new ApiError(401, 'Refresh token is invalid or expired');
  }

  user.refreshTokens = (user.refreshTokens || []).filter((item) => item.tokenHash !== tokenHash);
  return issueSession(user);
}

async function logout(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return;
  }

  await User.updateOne(
    { 'refreshTokens.tokenHash': hashToken(refreshToken) },
    { $pull: { refreshTokens: { tokenHash: hashToken(refreshToken) } } }
  );
}

async function requestPasswordReset(rawEmail) {
  const email = normalizeEmail(rawEmail);

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) {
    return {
      message: 'If the account exists, a reset email has been prepared'
    };
  }

  const resetToken = createPasswordResetToken();
  user.passwordResetTokenHash = hashToken(resetToken);
  user.passwordResetExpiresAt = getPasswordResetExpiryDate();
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}?resetToken=${resetToken}`;

  const response = {
    message: 'If the account exists, a reset email has been prepared',
    mockEmail: process.env.NODE_ENV === 'production' ? undefined : {
      to: user.email,
      subject: 'Reset your TodoFlow password',
      resetUrl,
      expiresInMinutes: 15
    }
  };

  if (!response.mockEmail) {
    delete response.mockEmail;
  }

  return response;
}

async function resetPassword({ token, password }) {
  const errors = validateAuthInput('user@example.com', password).filter((error) => !error.includes('email'));

  if (!token || typeof token !== 'string') {
    errors.push('Reset token is required');
  }

  if (errors.length) {
    throw new ApiError(400, 'Invalid reset data', errors);
  }

  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() }
  }).select('+password +passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) {
    throw new ApiError(401, 'Reset token is invalid or expired');
  }

  user.password = await bcrypt.hash(password, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.refreshTokens = [];
  await user.save();

  return { message: 'Password has been reset' };
}

module.exports = {
  login,
  logout,
  refreshSession,
  register,
  requestPasswordReset,
  resetPassword
};
