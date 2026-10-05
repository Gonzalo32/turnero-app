import { queueService, AddToQueueResult } from '../../modules/queue/queue.service';
import { QueueSource } from '../../modules/queue/queue.types';
import { Professional } from '../../modules/professionals/professional.model';
import { createError } from '../../middlewares/error.middleware';
import { TotemPatientRecord } from './totem.types';
import { logger } from '../../utils/logger';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Servicio de integración con el tótem.
 * Único lugar que conoce el formato del tótem: traduce su registro a una entrada de cola.
 */
export class TotemIntegrationService {

  async processTotemPatient(record: TotemPatientRecord): Promise<AddToQueueResult> {
    logger.info(`[TotemIntegration] Procesando registro del tótem: ${record._id}`);

    // El tótem identifica al profesional por nombre ("Nombre Apellido"); se traduce a ID acá.
    const [firstName, ...rest] = (record.profesional ?? '').trim().split(/\s+/);
    const lastName = rest.join(' ');
    const professional = firstName && lastName
      ? await Professional.findOne({
          firstName: { $regex: new RegExp(`^${escapeRegex(firstName)}$`, 'i') },
          lastName: { $regex: new RegExp(`^${escapeRegex(lastName)}$`, 'i') },
          active: true,
        })
      : null;

    if (!professional) {
      throw createError(`Profesional no encontrado: "${record.profesional ?? ''}"`, 422, 'PROFESSIONAL_NOT_FOUND');
    }

    return queueService.addToQueue({
      patientFirstName: record.nombre,
      patientLastName: record.apellido,
      patientDni: record.dni,
      healthInsurance: record.obraSocial,
      professionalId: professional._id.toString(),
      source: QueueSource.TOTEM,
      sourceRecordId: record._id,
    });
  }
}

export const totemIntegrationService = new TotemIntegrationService();
