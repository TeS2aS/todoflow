const blockedKeyPattern = /(^\$)|(\.)/;

function hasDangerousKey(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.keys(value).some((key) => {
    if (blockedKeyPattern.test(key)) {
      return true;
    }

    return hasDangerousKey(value[key]);
  });
}

function rejectDangerousPayload(req, res, next) {
  if (hasDangerousKey(req.body) || hasDangerousKey(req.query) || hasDangerousKey(req.params)) {
    return res.status(400).json({ message: 'Invalid payload keys' });
  }

  return next();
}

module.exports = {
  hasDangerousKey,
  rejectDangerousPayload
};
