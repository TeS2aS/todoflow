const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const session = await authService.register(req.body);
    return res.status(201).json(session);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const session = await authService.login(req.body);
    return res.json(session);
  } catch (error) {
    return next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const session = await authService.refreshSession(req.body.refreshToken);
    return res.json(session);
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.body.refreshToken);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const response = await authService.requestPasswordReset(req.body.email);
    return res.json(response);
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const response = await authService.resetPassword(req.body);
    return res.json(response);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  resetPassword
};
