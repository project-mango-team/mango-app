// Environment variables loaded via: node -r dotenv/config
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
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
import dolarRoutes from './routes/dolar.js';
import investmentRoutes from './routes/investments.js';
import loanRoutes from './routes/loans.js';
import bandejaRoutes from './routes/bandeja.js';
import tokenRoutes from './routes/tokens.js';
import ingestRoutes from './routes/ingest.js';
import jobRoutes from './routes/jobs.js';
import secretRoutes from './routes/secrets.js';
import notificationRoutes from './routes/notifications.js';
import { verificarClaveSecretos } from './services/secretService.js';
import './jobs/index.js';
import { iniciarScheduler } from './services/scheduler.js';
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

app.set('trust proxy', 1);

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
    sameSite: 'lax'
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
app.use('/api/dolar', dolarRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/bandeja', bandejaRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/secrets', secretRoutes);
app.use('/api/notifications', notificationRoutes);

if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  iniciarScheduler();
  verificarClaveSecretos();
});
