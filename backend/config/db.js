const mongoose = require('mongoose');

const DEFAULT_CONNECT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function maskMongoUri(uri) {
  return uri
    .replace(/\/\/([^:@/?#]+)(?::([^@/?#]*))?@/, '//<credentials>@')
    .replace(/\?.*$/, '?<options>');
}

function getDatabaseName(uri) {
  const match = uri.match(/\/([^/?]+)(?:\?|$)/);

  if (!match || !match[1]) {
    return 'default';
  }

  return decodeURIComponent(match[1]);
}

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in environment variables');
  }

  mongoose.set('strictQuery', true);
  mongoose.set('sanitizeFilter', true);

  const maxRetries = Math.max(1, getNumberEnv('MONGO_CONNECT_RETRIES', DEFAULT_CONNECT_RETRIES));
  const retryDelayMs = getNumberEnv('MONGO_CONNECT_RETRY_DELAY_MS', DEFAULT_RETRY_DELAY_MS);
  const maskedUri = maskMongoUri(mongoUri);
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      console.log(`MongoDB connecting (${attempt}/${maxRetries}) to ${maskedUri}`);
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000
      });
      console.log(`MongoDB connected to database "${getDatabaseName(mongoUri)}"`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`MongoDB connection failed (${attempt}/${maxRetries}): ${error.message}`);

      if (attempt < maxRetries) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  throw lastError;
}

module.exports = connectDB;
