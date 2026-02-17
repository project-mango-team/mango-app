import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import transactionRoutes from './routes/transactions.js';
import statsRoutes from './routes/stats.js';
import uploadRoutes from './routes/upload.js';
import migrateRoutes from './routes/migrate.js';
import operationsRoutes from './routes/operations.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar a MongoDB
connectDB();

// Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Mango API - Financial Management System' });
});

app.use('/api/transactions', transactionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/operations', operationsRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
