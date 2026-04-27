function getNotificationConfig() {
  return {
    localNotifications: true,
    pushReady: true,
    publicVapidKey: process.env.VAPID_PUBLIC_KEY || null
  };
}

async function saveSubscription(userId, subscription) {
  return {
    userId,
    subscriptionPreview: subscription ? {
      endpoint: subscription.endpoint,
      hasKeys: Boolean(subscription.keys)
    } : null,
    message: 'Push subscription received. Persistence provider can be added for production.'
  };
}

module.exports = {
  getNotificationConfig,
  saveSubscription
};
