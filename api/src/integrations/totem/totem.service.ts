import { queueService } from '../../modules/queue/queue.service';
import { QueueStatus } from '../../modules/queue/queue.types';
import { Professional } from '../../modules/professionals/professional.model';
import { Patient } from '../../modules/patients/patient.model';
import { Atencion } from '../../modules/atenciones/atencion.model';
import { TotemPatientRecord } from './totem.types';
import { logger } from '../../utils/logger';
import { emitPatientAdded, emitPatientCancelled } from '../../modules/queue/queue.socket';

/**
 * Servicio de integración con el tótem.
 * Guarda los datos del paciente en 'pacientes' y el turno/visita en 'atenciones'.
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

      const ahora = new Date();

      // Datos estrictamente filiatorios del paciente para la colección 'pacientes'
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
      };

      const setOnInsert: any = {};
      if (record._id) {
        setOnInsert._id = record._id;
      }

      const patient = await Patient.findOneAndUpdate(
        { dni: record.dni },
        { 
          $setOnInsert: setOnInsert,
          $set: patientData 
        },
        { upsert: true, new: true }
      );

      // Registrar en la colección 'atenciones' como documento individual
      if (professionalId) {
        const oneMinuteAgo = new Date(ahora.getTime() - 60000);

        // Verificar si ya tiene una atención en espera reciente para evitar duplicar
        let atencion = await Atencion.findOne({
          patientId: patient._id,
          professionalId: professionalId,
          estado: QueueStatus.WAITING,
          fecha: { $gte: oneMinuteAgo },
        });

        if (!atencion) {
          atencion = await Atencion.create({
            patientId: patient._id,
            professionalId: professionalId,
            fecha: ahora,
            estado: QueueStatus.WAITING,
          });
          logger.info(`[TotemIntegration] ✓ Registro de atención individual creado en 'atenciones' para DNI ${patient.dni} (ID: ${atencion._id})`);
        } else {
          logger.info(`[TotemIntegration] ℹ Atención en espera reciente ya existente para DNI ${patient.dni} (ID: ${atencion._id})`);
        }

        // Emitir paciente en espera para la pantalla del odontólogo en tiempo real
        emitPatientAdded({
          _id: atencion._id,
          patientId: patient._id,
          dni: patient.dni,
          nombre: patient.nombre,
          apellido: patient.apellido,
          obraSocial: patient.obraSocial,
          profesional: patient.profesional,
          profesionalId: professionalId,
          estado: QueueStatus.WAITING,
          status: QueueStatus.WAITING,
          joinedAt: atencion.fecha,
          fecha: atencion.fecha,
        });
      }

      logger.info(`[TotemIntegration] ✓ Paciente guardado en 'pacientes': ${patient.nombre} ${patient.apellido}`);
    } catch (error) {
      logger.error('[TotemIntegration] Error procesando paciente del tótem:', error);
    }
  }
}

export const totemIntegrationService = new TotemIntegrationService();
