import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

import { config } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { initQueueSocket } from './modules/queue/queue.socket';
import queueRoutes from './modules/queue/queue.routes';
import professionalRoutes from './modules/professionals/professional.routes';
import { totemIntegrationService } from './integrations/totem/totem.service';
import mongoose from 'mongoose';

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

// ── Endpoint de integración con el tótem ─────────────────────────────────────
/**
 * POST /api/v1/integrations/totem/patient
 * El tótem llama este endpoint cuando un paciente finaliza el registro.
 * Internamente se delega a TotemIntegrationService (aislado y desacoplado).
 */
app.post('/api/v1/integrations/totem/patient', async (req, res, next) => {
  try {
    await totemIntegrationService.processTotemPatient(req.body);
    res.json({ success: true, data: null, message: 'Paciente procesado' });
  } catch (err) {
    next(err);
  }
});

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

// ── Manejo centralizado de errores (debe ir al final) ────────────────────────
app.use(errorMiddleware);

export { app, httpServer, io };
