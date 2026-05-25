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

const toServiceApiPath = (path: string) => `/api/v1${path}`;
const toAuthServiceApiPath = (path: string) => `/api/v1/auth${path}`;

// Route to Auth Service
app.use('/api/v1/auth', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: toAuthServiceApiPath
}));

// Route to CRM Service
app.use('/api/v1/crm', createProxyMiddleware({
  target: 'http://localhost:3020',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

// Route to HR Service
app.use('/api/v1/hr', createProxyMiddleware({
  target: 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

// Route to Quality Service
app.use('/api/v1/quality', createProxyMiddleware({
  target: 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

// Route to Calendar Service
app.use('/api/v1/calendar', createProxyMiddleware({
  target: 'http://localhost:3005',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

// Route to Staffing Service
app.use('/api/v1/staffing', createProxyMiddleware({
  target: 'http://localhost:3006',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

// Route to Notifications Service
app.use('/api/v1/notifications', createProxyMiddleware({
  target: 'http://localhost:3007',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

// Route to Geo Service
app.use('/api/v1/geo', createProxyMiddleware({
  target: 'http://localhost:3008',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

// Route to Chatbot Service
app.use('/api/v1/chatbot', createProxyMiddleware({
  target: 'http://localhost:3009',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

// Route to Analytics Service
app.use('/api/v1/analytics', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true,
  pathRewrite: toServiceApiPath
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
