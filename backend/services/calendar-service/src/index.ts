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
    service: 'calendar-service',
    timestamp: new Date()
  });
});

app.get('/api/v1/schedules', (req, res) => {
  res.json({ message: 'Get schedules - coming soon' });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Calendar Service running on port ${PORT}`);
});
