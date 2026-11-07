import { queueService, AddToQueueResult } from '../../modules/queue/queue.service';
import { QueueSource } from '../../modules/queue/queue.types';
import { Professional } from '../../modules/professionals/professional.model';
import { createError } from '../../middlewares/error.middleware';
import { TotemPatientRecord, TotemProfessionalSync } from './totem.types';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Servicio de integración con el tótem.
 * Responsable de la comunicación bidireccional entre el turnero y el tótem:
 * 1. Procesa los registros de pacientes entrantes desde el tótem.
 * 2. Sincroniza la lista y modificaciones de profesionales hacia el tótem.
 */
export class TotemIntegrationService {

  /** Obtiene la lista de profesionales activos en el formato requerido por el tótem */
  async getActiveProfessionalsForTotem(): Promise<TotemProfessionalSync[]> {
    const list = await Professional.find({ active: true })
      .select('_id firstName lastName licenseNumber active')
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    return list.map((p) => ({
      _id: p._id.toString(),
      nombre: p.firstName,
      apellido: p.lastName,
      matricula: p.licenseNumber || '',
      activo: p.active !== false,
    }));
  }

  /**
   * Sincroniza un profesional individual con el tótem vía HTTP POST.
   * Maneja errores en segundo plano para no bloquear las operaciones del turnero.
   */
  async syncProfessionalToTotem(data: TotemProfessionalSync): Promise<void> {
    try {
      const url = `${config.totemApiUrl}/api/professionals/sync`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-totem-api-key': config.totemApiKey,
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok) {
        logger.info(`[TotemIntegration] ✓ Profesional sincronizado con el tótem: ${data.nombre} ${data.apellido} (${data._id})`);
      } else {
        logger.warn(`[TotemIntegration] Respuesta no exitosa al sincronizar con tótem: HTTP ${response.status}`);
      }
    } catch (err: any) {
      logger.warn(`[TotemIntegration] Tótem no alcanzable para sincronización directa en tiempo real: ${err.message}`);
    }
  }

  /**
   * Sincronización masiva de todos los profesionales activos hacia el tótem.
   */
  async syncAllProfessionalsToTotem(): Promise<void> {
    try {
      const list = await this.getActiveProfessionalsForTotem();
      const url = `${config.totemApiUrl}/api/professionals/bulk-sync`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-totem-api-key': config.totemApiKey,
        },
        body: JSON.stringify({ professionals: list }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        logger.info(`[TotemIntegration] ✓ Sincronización masiva con el tótem completada (${list.length} profesionales)`);
      } else {
        logger.warn(`[TotemIntegration] Respuesta no exitosa en sincronización masiva con tótem: HTTP ${response.status}`);
      }
    } catch (err: any) {
      logger.warn(`[TotemIntegration] Tótem no alcanzable para sincronización masiva: ${err.message}`);
    }
  }

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
      telefono: record.telefono,
      fechaNacimiento: record.fechaNacimiento,
      numeroAfiliado: record.numeroAfiliado,
      localidad: record.localidad,
      domicilio: record.domicilio,
      observacion: record.observacion,
    });
  }
}

export const totemIntegrationService = new TotemIntegrationService();
