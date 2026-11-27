import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { mkdir } from 'node:fs/promises';
import { initializeDatabase, verifyDatabaseConnection } from './db.js';
import { getUploadDirectory, uploadsRoot } from './utils/uploadPaths.js';
import { verifySmtpConnection } from './services/emailService.js';
import { isSmsConfigured } from './services/smsService.js';
import authRouter from './routes/authRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import clientRouter from './routes/clientRoutes.js';
import traderRouter from './routes/traderRoutes.js';
import { apiInfo, health } from './controllers/systemController.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const railwayOrigin = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : '';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || railwayOrigin || 'http://localhost:7904';
const allowedOrigins = [
  ...CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  'https://localhost',
];
const explicitOrigins = new Set();
const wildcardOrigins = [];

for (const origin of allowedOrigins) {
  if (origin.includes('*')) {
    wildcardOrigins.push(origin);
    continue;
  }

  explicitOrigins.add(origin);
}

function isOriginAllowed(origin) {
  if (explicitOrigins.has(origin)) {
    return true;
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  for (const pattern of wildcardOrigins) {
    const wildcardMatch = pattern.match(/^(https?):\/\/\*\.(.+)$/i);
    if (!wildcardMatch) {
      continue;
    }

    const [, protocol, hostSuffix] = wildcardMatch;
    if (parsedOrigin.protocol === `${protocol.toLowerCase()}:` && parsedOrigin.hostname.endsWith(`.${hostSuffix.toLowerCase()}`)) {
      return true;
    }
  }

  return false;
}
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());
app.use(morgan('dev'));
for (const directory of ['products_img', 'profile_img', 'paper_docs', 'messenger', 'gcash_qr', 'payment_receipts']) {
  app.use(`/uploads/${directory}`, express.static(getUploadDirectory(directory)));
}

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'CocoLytics Backend is running.',
    service: 'CocoLytics API',
    api: '/api',
    health: '/api/health',
  });
});
app.get('/api/health', health);
app.get('/api', apiInfo);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/client', clientRouter);
app.use('/api/trader', traderRouter);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});

async function startServer() {
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.UPLOADS_DIR) {
      throw new Error('Set UPLOADS_DIR to a persistent volume path before starting in production.');
    }

    await mkdir(uploadsRoot, { recursive: true });

    if (process.env.NODE_ENV !== 'production') {
      await initializeDatabase();
    } else {
      await verifyDatabaseConnection();
    }

    const smtpStatus = await verifySmtpConnection();
    if (smtpStatus.ready) {
      console.log('Gmail SMTP is ready for OTP delivery.');
    } else {
      console.warn(`Gmail SMTP is not ready: ${smtpStatus.reason}`);
    }
    if (!isSmsConfigured()) {
      console.warn('Twilio SMS is not configured; phone verification codes cannot be delivered.');
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend listening on 0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend:', error?.message || error?.code || String(error));
    process.exit(1);
  }
}

startServer();
