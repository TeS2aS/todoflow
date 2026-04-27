const notificationService = require('../services/notificationService');

function getConfig(req, res) {
  return res.json(notificationService.getNotificationConfig());
}

async function subscribe(req, res, next) {
  try {
    const result = await notificationService.saveSubscription(req.userId, req.body.subscription);
    return res.status(202).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getConfig,
  subscribe
};
