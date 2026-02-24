import express from 'express';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import convertRouter from './routes/convert';
import subscriptionRouter from './routes/subscription';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Security headers — relaxed CSP for SPA frontend
app.use(helmet({
  contentSecurityPolicy: false,   // SPA uses inline scripts/styles from build
  crossOriginEmbedderPolicy: false,
}));

// Global rate limit: 120 requests per minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
}));

// Stricter rate limit for conversion/shorten endpoints
const convertLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many conversion requests, please try again later' },
});

app.use(express.json({ limit: '5mb' }));

// Health check — must be before other routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API routes
app.use('/api/convert', convertLimiter, convertRouter);
app.use('/api/shorten', convertLimiter);
app.use('/api', subscriptionRouter);

// Static frontend
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SubConverter running on http://localhost:${PORT}`);
});
