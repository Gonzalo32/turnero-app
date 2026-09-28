import { queueService } from '../../modules/queue/queue.service';
import { QueueSource } from '../../modules/queue/queue.types';
import { Professional } from '../../modules/professionals/professional.model';
import { TotemPatientRecord } from './totem.types';
import { logger } from '../../utils/logger';
import {
  emitPatientAdded,
} from '../../modules/queue/queue.socket';

/**
 * Servicio de integración con el tótem.
 * AGENTS.md §35: Aísla todos los detalles del tótem fuera de los módulos internos.
 * AGENTS.md §25: Garantiza idempotencia usando sourceRecordId.
 *
 * Este servicio es el ÚNICO punto de entrada de datos del tótem al nuevo sistema.
 * Cualquier cambio en la estructura del tótem solo afecta a este archivo.
 */
export class TotemIntegrationService {

  /**
   * Procesa un registro de paciente llegado desde el tótem.
   * Busca el profesional por nombre (mapeo tótem → ID interno),
   * luego crea la entrada en la cola con idempotencia garantizada.
   *
   * Flujo (AGENTS.md §10):
   * Tótem → Integración → QueueService → MongoDB → Socket.IO → Profesional
   */
  async processTotemPatient(record: TotemPatientRecord): Promise<void> {
    try {
      logger.info(`[TotemIntegration] Procesando paciente del tótem: ${record._id}`);

      if (!record.profesional) {
        logger.warn(`[TotemIntegration] Registro sin profesional, ignorado: ${record._id}`);
        return;
      }

      // Mapear nombre del tótem a _id del sistema
      const [firstName, ...rest] = record.profesional.trim().split(' ');
      const lastName = rest.join(' ');

      const professional = await Professional.findOne({
        firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
        lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
        active: true,
      });

      if (!professional) {
        logger.warn(
          `[TotemIntegration] Profesional no encontrado en sistema: "${record.profesional}"`
        );
        return;
      }

      // Agregar a la cola con idempotencia (sourceRecordId evita duplicados)
      const entry = await queueService.addToQueue({
        patientFirstName: record.nombre,
        patientLastName: record.apellido,
        patientDni: record.dni,
        healthInsurance: record.obraSocial ?? 'Particular',
        professionalId: professional._id.toString(),
        source: QueueSource.TOTEM,
        sourceRecordId: record._id,
      });

      // Emitir DESPUÉS de persistir (AGENTS.md §22)
      emitPatientAdded(entry);

      logger.info(`[TotemIntegration] Entrada creada en cola: ${entry._id}`);
    } catch (error) {
      logger.error('[TotemIntegration] Error procesando paciente del tótem:', error);
    }
  }
}

export const totemIntegrationService = new TotemIntegrationService();
