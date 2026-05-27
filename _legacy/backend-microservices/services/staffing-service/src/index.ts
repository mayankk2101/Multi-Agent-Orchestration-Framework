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
    service: 'staffing-service',
    timestamp: new Date()
  });
});

app.post('/api/v1/work-requests', (req, res) => {
  res.json({ message: 'Create work request - coming soon' });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Staffing Service running on port ${PORT}`);
});
