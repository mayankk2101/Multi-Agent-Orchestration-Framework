import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'analytics-service',
    timestamp: new Date()
  });
});

app.get('/api/v1/analytics', (req, res) => {
  res.json({ message: 'Get analytics - coming soon' });
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});
