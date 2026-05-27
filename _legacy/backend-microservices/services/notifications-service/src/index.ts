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
    service: 'notifications-service',
    timestamp: new Date()
  });
});

app.post('/api/v1/notifications', (req, res) => {
  res.json({ message: 'Send notification - coming soon' });
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
  console.log(`Notifications Service running on port ${PORT}`);
});
