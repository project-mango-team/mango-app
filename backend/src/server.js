// Environment variables loaded via: node -r dotenv/config
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import passportConfig from './config/passport.js';
import connectDB from './config/database.js';
import transactionRoutes from './routes/transactions.js';
import statsRoutes from './routes/stats.js';
import uploadRoutes from './routes/upload.js';
import migrateRoutes from './routes/migrate.js';
import operationsRoutes from './routes/operations.js';
import authRoutes from './routes/auth.js';
import categoriesRoutes from './routes/categories.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Conectar a MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'mango-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DATABASE || 'Mango',
    touchAfter: 24 * 3600 // Lazy session update (in seconds)
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Initialize Passport
app.use(passportConfig.initialize());
app.use(passportConfig.session());

// Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Mango API - Financial Management System' });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/categories', categoriesRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
