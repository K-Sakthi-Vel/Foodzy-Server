import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/',(req, res) => {
  return res.send('Welcome to foodzy backend api')
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
