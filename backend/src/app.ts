import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { initQueueSocket } from './modules/queue/queue.socket';
import queueRoutes from './modules/queue/queue.routes';
import professionalRoutes from './modules/professionals/professional.routes';
import authRoutes from './modules/auth/auth.routes';
import totemRoutes from './integrations/totem/totem.routes';
import mongoose from 'mongoose';
import path from 'path';

const app = express();

// Detrás de un único reverse proxy (Caddy): necesario para que el rate limit vea la IP real.
app.set('trust proxy', 1);

// ── HTTP Server ──────────────────────────────────────────────────────────────
const httpServer = createServer(app);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Inicializar módulo socket de la cola
initQueueSocket(io);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

// Tope general por IP. Holgado: todo el consultorio suele compartir una IP pública.
app.use(
  '/api/v1',
  rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false })
);

// ── Rutas API v1 ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/professionals', professionalRoutes);

// ── Integración con el tótem ─────────────────────────────────────────────────
app.use('/api/v1/integrations/totem', totemRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    // Solo estado general: sin detalles internos para quien no está autenticado.
    data: { status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded' },
    message: null,
  });
});

// ── Frontend estático (producción / Docker) ──────────────────────────────────
// Si PUBLIC_DIR está definido, Express sirve el build de Angular en el mismo origen.
const publicDir = process.env['PUBLIC_DIR'];
if (publicDir) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

// ── Manejo centralizado de errores (debe ir al final) ────────────────────────
app.use(errorMiddleware);

export { app, httpServer, io };
