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
    service: 'geo-service',
    timestamp: new Date()
  });
});

app.post('/api/v1/locations', (req, res) => {
  res.json({ message: 'Update location - coming soon' });
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
  console.log(`Geo Service running on port ${PORT}`);
});
