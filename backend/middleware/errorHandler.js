function errorHandler(error, req, res, next) {
  if (error.name === 'ApiError') {
    return res.status(error.statusCode).json({
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    });
  }

  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: 'Validation error', details });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier' });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Payload too large' });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  if (error.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed by CORS' });
  }

  console.error(error);
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = errorHandler;
