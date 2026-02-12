import express from 'express';
import path from 'path';
import convertRouter from './routes/convert';
import subscriptionRouter from './routes/subscription';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '5mb' }));

// API routes
app.use('/api/convert', convertRouter);
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
