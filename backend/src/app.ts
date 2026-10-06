import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

import { config } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { initQueueSocket } from './modules/queue/queue.socket';
import queueRoutes from './modules/queue/queue.routes';
import professionalRoutes from './modules/professionals/professional.routes';
import totemRoutes from './integrations/totem/totem.routes';
import mongoose from 'mongoose';
import path from 'path';

const app = express();

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
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// ── Rutas API v1 ─────────────────────────────────────────────────────────────
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/professionals', professionalRoutes);

// ── Integración con el tótem ─────────────────────────────────────────────────
app.use('/api/v1/integrations/totem', totemRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      socketClients: io.engine.clientsCount,
    },
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
