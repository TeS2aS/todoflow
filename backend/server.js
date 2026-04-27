require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const taskRoutes = require('./routes/taskRoutes');
const errorHandler = require('./middleware/errorHandler');
const createRateLimiter = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const { rejectDangerousPayload } = require('./utils/security');

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is missing in environment variables');
}

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const localOrigins = process.env.NODE_ENV === 'production' ? [] : [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
const allowedOrigins = [
  ...parseOrigins(process.env.CLIENT_URL),
  ...parseOrigins(process.env.CLIENT_URLS),
  ...parseOrigins(process.env.FRONTEND_URL),
  vercelOrigin,
  ...localOrigins
].filter(Boolean);

app.set('query parser', 'simple');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'http://localhost:5000', 'http://127.0.0.1:5000'],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

app.use(createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 300,
  keyPrefix: 'api'
}));

app.use(requestLogger);

app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = origin ? origin.replace(/\/+$/, '') : '';

    if (!origin || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '20kb' }));
app.use(rejectDangerousPayload);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/notifications', notificationRoutes);

app.use(express.static(path.join(__dirname, '../frontend')));

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Unable to connect to MongoDB:', error.message);
    process.exit(1);
  });
