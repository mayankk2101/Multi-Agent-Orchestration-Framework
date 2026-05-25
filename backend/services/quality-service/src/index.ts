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
    service: 'quality-service',
    timestamp: new Date()
  });
});

app.post('/api/v1/ratings', (req, res) => {
  res.json({ message: 'Create rating - coming soon' });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`Quality Service running on port ${PORT}`);
});
