import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();

app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date()
  });
});

const rewriteMountedPath = (downstreamBasePath: string) => (path: string) => {
  const suffix = path === '/' ? '' : path;
  return `${downstreamBasePath}${suffix}`;
};

// Routes (BEFORE express.json())
app.use('/api/v1/auth', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1/auth')
}));

app.use('/api/v1/crm', createProxyMiddleware({
  target: 'http://localhost:3020',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1')
}));

app.use('/api/v1/hr', createProxyMiddleware({
  target: 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1')
}));

app.use('/api/v1/quality', createProxyMiddleware({
  target: 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1')
}));

app.use('/api/v1/calendar', createProxyMiddleware({
  target: 'http://localhost:3005',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1')
}));

app.use('/api/v1/staffing', createProxyMiddleware({
  target: 'http://localhost:3006',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1')
}));

app.use('/api/v1/notifications', createProxyMiddleware({
  target: 'http://localhost:3007',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1')
}));

app.use('/api/v1/geo', createProxyMiddleware({
  target: 'http://localhost:3008',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1')
}));

app.use('/api/v1/chatbot', createProxyMiddleware({
  target: 'http://localhost:3009',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1')
}));

app.use('/api/v1/analytics', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true,
  pathRewrite: rewriteMountedPath('/api/v1/analytics')
}));

// Middleware (AFTER proxy routes)
app.use(express.json());

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
