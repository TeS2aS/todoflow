const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication token is required' });
  }

  try {
    // The authenticated user id is reused by task queries to enforce ownership.
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication token is invalid or expired' });
  }
}

module.exports = auth;
