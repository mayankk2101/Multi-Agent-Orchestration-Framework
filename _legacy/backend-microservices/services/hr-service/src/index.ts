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
    service: 'hr-service',
    timestamp: new Date()
  });
});

app.get('/api/v1/contracts', (req, res) => {
  res.json({ message: 'Get contracts - coming soon' });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`HR Service running on port ${PORT}`);
});
