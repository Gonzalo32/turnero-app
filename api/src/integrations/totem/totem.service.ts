import { queueService } from '../../modules/queue/queue.service';
import { QueueSource } from '../../modules/queue/queue.types';
import { Professional } from '../../modules/professionals/professional.model';
import { Patient } from '../../modules/patients/patient.model';
import { TotemPatientRecord } from './totem.types';
import { logger } from '../../utils/logger';
import { emitPatientAdded } from '../../modules/queue/queue.socket';

/**
 * Servicio de integración con el tótem.
 * Guarda al paciente en la colección 'patients' con su esquema completo
 * y lo agrega a la cola de espera 'queueentries'.
 */
export class TotemIntegrationService {

  async processTotemPatient(record: TotemPatientRecord): Promise<void> {
    try {
      logger.info(`[TotemIntegration] Procesando paciente del tótem: ${record._id}`);

      // 1. Guardar/actualizar en la colección patients con el modelo idéntico
      await Patient.findOneAndUpdate(
        { dni: record.dni },
        {
          $set: {
            dni: record.dni,
            nombre: record.nombre,
            apellido: record.apellido,
            telefono: record.telefono,
            fechaNacimiento: record.fechaNacimiento,
            obraSocial: record.obraSocial,
            numeroAfiliado: record.numeroAfiliado,
            profesional: record.profesional,
            localidad: record.localidad,
            domicilio: record.domicilio,
            observacion: record.observacion ?? [],
            createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
          },
        },
        { upsert: true, new: true }
      );
      logger.info(`[TotemIntegration] Paciente guardado en colección 'patients': ${record.dni}`);

      if (!record.profesional) {
        logger.warn(`[TotemIntegration] Registro sin profesional, no se agrega a la cola: ${record._id}`);
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

      // Emitir evento por sockets
      emitPatientAdded(entry);

      logger.info(`[TotemIntegration] Entrada creada en cola: ${entry._id}`);
    } catch (error) {
      logger.error('[TotemIntegration] Error procesando paciente del tótem:', error);
    }
  }
}

export const totemIntegrationService = new TotemIntegrationService();
