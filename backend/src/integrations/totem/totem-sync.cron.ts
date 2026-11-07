import { totemIntegrationService } from './totem.service';
import { logger } from '../../utils/logger';

const INTERVALO_24_HORAS = 24 * 60 * 60 * 1000;

/**
 * Tarea periódica de sincronización diaria entre el turnero central y la base de datos del tótem.
 * AGENTS.md §22: Persistencia primero; la sincronización no debe detener el funcionamiento del backend.
 */
export function startTotemDailySync(): void {
  logger.info('[TotemSync] Tarea de sincronización diaria programada (cada 24 horas).');

  // Chequeo inicial diferido unos segundos tras el bootstrap
  setTimeout(() => {
    totemIntegrationService.syncAllProfessionalsToTotem().catch((err) => {
      logger.warn(`[TotemSync] Sincronización inicial con tótem diferida: ${err.message}`);
    });
  }, 10_000);

  // Intervalo diario
  setInterval(() => {
    logger.info('[TotemSync] Ejecutando verificación diaria de sincronización de profesionales...');
    totemIntegrationService.syncAllProfessionalsToTotem().catch((err) => {
      logger.warn(`[TotemSync] Error en verificación diaria con el tótem: ${err.message}`);
    });
  }, INTERVALO_24_HORAS);
}
