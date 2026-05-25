import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();

app.use(cors());

// Health check (before proxy routes)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date()
  });
});

// Proxy middleware functions
const createAuthProxy = () => createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/v1/auth': '' }
});

const createServiceProxy = (port) => createProxyMiddleware({
  target: `http://localhost:${port}`,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/[^/]+': '' }
});

// Routes (BEFORE express.json())
app.use('/api/v1/auth', createAuthProxy());
app.use('/api/v1/crm', createServiceProxy(3020));
app.use('/api/v1/hr', createServiceProxy(3003));
app.use('/api/v1/quality', createServiceProxy(3004));
app.use('/api/v1/calendar', createServiceProxy(3005));
app.use('/api/v1/staffing', createServiceProxy(3006));
app.use('/api/v1/notifications', createServiceProxy(3007));
app.use('/api/v1/geo', createServiceProxy(3008));
app.use('/api/v1/chatbot', createServiceProxy(3009));
app.use('/api/v1/analytics', createServiceProxy(3010));

// Middleware (AFTER proxy routes)
app.use(express.json());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
