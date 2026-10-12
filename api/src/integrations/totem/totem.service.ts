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

      // Registrar en la nueva tabla 'atenciones'
      if (professionalId) {
        const oneMinuteAgo = new Date(ahora.getTime() - 60000);

        // Verificar si ya tiene una atención en espera reciente para evitar duplicar
        const existingDoc = await Atencion.findOne({
          patientId: patient._id,
          atenciones: {
            $elemMatch: {
              professionalId: professionalId,
              estado: QueueStatus.WAITING,
              fecha: { $gte: oneMinuteAgo },
            },
          },
        });

        let itemToEmit: any;

        if (existingDoc) {
          itemToEmit = existingDoc.atenciones.find(
            (a) => a.professionalId.toString() === professionalId.toString() && a.estado === QueueStatus.WAITING
          );
        } else {
          const doc = await Atencion.findOneAndUpdate(
            { patientId: patient._id },
            {
              $push: {
                atenciones: {
                  professionalId: professionalId,
                  fecha: ahora,
                  estado: QueueStatus.WAITING,
                },
              },
            },
            { upsert: true, new: true }
          );
          itemToEmit = doc.atenciones[doc.atenciones.length - 1];
        }

        logger.info(`[TotemIntegration] ✓ Registro de atención en 'atenciones' para DNI ${patient.dni} (Item ID: ${itemToEmit._id})`);

        // Emitir paciente en espera para la pantalla del odontólogo en tiempo real
        emitPatientAdded({
          _id: itemToEmit._id,
          patientId: patient._id,
          dni: patient.dni,
          nombre: patient.nombre,
          apellido: patient.apellido,
          obraSocial: patient.obraSocial,
          profesional: patient.profesional,
          profesionalId: professionalId,
          estado: QueueStatus.WAITING,
          status: QueueStatus.WAITING,
          joinedAt: itemToEmit.fecha,
          fecha: itemToEmit.fecha,
        });
      }

      logger.info(`[TotemIntegration] ✓ Paciente guardado en 'pacientes': ${patient.nombre} ${patient.apellido}`);
    } catch (error) {
      logger.error('[TotemIntegration] Error procesando paciente del tótem:', error);
    }
  }
}

export const totemIntegrationService = new TotemIntegrationService();
