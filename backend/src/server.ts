import { connectDatabase } from './database/connection';
import { config } from './config/env';
import { logger } from './utils/logger';
import { httpServer } from './app';
import { startTotemDailySync } from './integrations/totem/totem-sync.cron';

/**
 * Entry point del servidor.
 * Orden obligatorio (AGENTS.md §22):
 * 1. Conectar BD → 2. Iniciar servidor HTTP/Socket.IO → 3. Inicializar tareas en segundo plano
 */
async function bootstrap(): Promise<void> {
  try {
    // 1. Conectar a MongoDB antes de aceptar requests
    await connectDatabase();

    // 2. Iniciar servidor HTTP + Socket.IO
    httpServer.listen(config.port, () => {
      logger.info(`Servidor iniciado en puerto ${config.port}`);
      logger.info(`Entorno: ${config.nodeEnv}`);
      logger.info(`Socket.IO listo`);

      // 3. Iniciar tarea de sincronización diaria con el tótem
      startTotemDailySync();
    });
  } catch (error) {
    logger.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

bootstrap();
