import mongoose from 'mongoose';
import { config } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Conecta a la base de datos MongoDB del sistema (senza_sistema).
 * Reintenta en caso de fallo con backoff exponencial simple.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri);
    logger.info(`MongoDB conectado: ${mongoose.connection.name}`);
  } catch (error) {
    logger.error('Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB desconectado');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconectado');
});
