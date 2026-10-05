import { queueService } from '../../modules/queue/queue.service';
import { QueueStatus } from '../../modules/queue/queue.types';
import { Professional } from '../../modules/professionals/professional.model';
import { Patient } from '../../modules/patients/patient.model';
import { TotemPatientRecord } from './totem.types';
import { logger } from '../../utils/logger';
import { emitPatientAdded, emitPatientCancelled } from '../../modules/queue/queue.socket';

/**
 * Servicio de integración con el tótem.
 * Almacena el historial de visitas y cambios de profesional directamente en la colección 'patients'.
 */
export class TotemIntegrationService {

  async processTotemPatient(record: TotemPatientRecord): Promise<void> {
    try {
      logger.info(`[TotemIntegration] Procesando paciente del tótem: ${record._id} (DNI ${record.dni})`);

      let professionalId: any = undefined;

      if (record.profesional) {
        const [firstName, ...rest] = record.profesional.trim().split(' ');
        const lastName = rest.join(' ');

        const professional = await Professional.findOne({
          firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
          lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
          active: true,
        });

        if (professional) {
          professionalId = professional._id;
        } else {
          logger.warn(`[TotemIntegration] Profesional no encontrado en sistema: "${record.profesional}"`);
        }
      }

      // Buscar si ya existía el paciente para registrar la visita y auditoría
      const existing = await Patient.findOne({ dni: record.dni });

      // Idempotencia (AGENTS.md §25): el tótem puede reenviar el mismo registro.
      // Si ya está activo en la cola del mismo profesional, no se crea otra visita.
      const activeStatuses = [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_ATTENTION];
      if (
        existing &&
        activeStatuses.includes(existing.status) &&
        String(existing.profesionalId ?? '') === String(professionalId ?? '')
      ) {
        logger.info(`[TotemIntegration] Registro ${record._id} ya activo en cola, ignorado (idempotencia)`);
        return;
      }
      const ahora = new Date();
      const fechaStr = `${ahora.getDate()}/${ahora.getMonth() + 1}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

      let totalVisitas = 1;
      let visitas: any[] = [];
      let cambiosProfesional: any[] = [];
      let transferredFromProfId: string | undefined;

      if (existing) {
        totalVisitas = (existing.totalVisitas || existing.visitas?.length || 1) + 1;
        visitas = Array.isArray(existing.visitas) ? [...existing.visitas] : [];
        cambiosProfesional = Array.isArray(existing.cambiosProfesional) ? [...existing.cambiosProfesional] : [];

        // Registrar si hubo cambio de profesional
        const profAnterior = existing.profesional;
        const profNuevo = record.profesional;
        if (profAnterior && profNuevo && profAnterior.toLowerCase().trim() !== profNuevo.toLowerCase().trim()) {
          cambiosProfesional.push({
            fecha: ahora,
            fechaStr,
            profesionalAnterior: profAnterior,
            profesionalNuevo: profNuevo,
          });
          logger.info(`[TotemIntegration] ⇄ Cambio de profesional para DNI ${record.dni}: ${profAnterior} → ${profNuevo}`);
          if (existing.profesionalId && professionalId && existing.profesionalId.toString() !== professionalId.toString()) {
            transferredFromProfId = existing.profesionalId.toString();
          }
        }
      }

      // Registrar la visita actual
      visitas.push({
        numeroVisita: totalVisitas,
        fecha: ahora,
        fechaStr,
        profesional: record.profesional,
        profesionalId: professionalId || null,
        obraSocial: record.obraSocial || 'Particular',
        estado: QueueStatus.WAITING,
        atendidoAt: null,
      });

      const patientData: any = {
        dni: record.dni,
        nombre: record.nombre,
        apellido: record.apellido,
        telefono: record.telefono,
        fechaNacimiento: record.fechaNacimiento,
        obraSocial: record.obraSocial || 'Particular',
        numeroAfiliado: record.numeroAfiliado,
        profesional: record.profesional,
        localidad: record.localidad,
        domicilio: record.domicilio,
        observacion: record.observacion ?? [],
        estado: QueueStatus.WAITING,
        status: QueueStatus.WAITING,
        joinedAt: ahora,
        calledAt: null,
        attentionStartedAt: null,
        completedAt: null,
        cancelledAt: null,
        totalVisitas,
        visitas,
        cambiosProfesional,
      };

      if (professionalId) {
        patientData.profesionalId = professionalId;
      }

      const patient = await Patient.findOneAndUpdate(
        { dni: record.dni },
        { $set: patientData },
        { upsert: true, new: true }
      );

      // Si fue transferido de otro profesional, avisar a la pantalla del anterior para que lo remueva
      if (transferredFromProfId) {
        emitPatientCancelled({ ...patient.toObject(), profesionalId: transferredFromProfId });
      }

      // Emitir paciente en espera para la pantalla del odontólogo
      emitPatientAdded(patient);

      logger.info(`[TotemIntegration] ✓ Paciente guardado en 'patients' (Visita #${totalVisitas}): ${patient.nombre} ${patient.apellido}`);
    } catch (error) {
      logger.error('[TotemIntegration] Error procesando paciente del tótem:', error);
      throw error;
    }
  }
}

export const totemIntegrationService = new TotemIntegrationService();
