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
    service: 'crm-service',
    timestamp: new Date()
  });
});

app.get('/api/v1/hotels', (req, res) => {
  res.json({ message: 'Get hotels - coming soon' });
});

app.post('/api/v1/tasks', (req, res) => {
  res.json({ message: 'Create task - coming soon' });
});

const PORT = process.env.PORT || 3020;
app.listen(PORT, () => {
  console.log(`CRM Service running on port ${PORT}`);
});
