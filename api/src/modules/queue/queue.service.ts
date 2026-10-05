import { Types } from 'mongoose';
import { Patient, IPatient } from '../patients/patient.model';
import { QueueStatus, QueueSource, CreateQueueEntryDto } from './queue.types';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';

export class QueueService {

  async getActiveQueue(professionalId?: string): Promise<IPatient[]> {
    const filter: Record<string, unknown> = {
      $or: [
        { estado: { $in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_ATTENTION] } },
        { status: { $in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_ATTENTION] } },
      ],
    };

    if (professionalId) {
      if (!Types.ObjectId.isValid(professionalId)) {
        throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
      }
      filter['profesionalId'] = new Types.ObjectId(professionalId);
    }

    return Patient
      .find(filter)
      .sort({ joinedAt: 1, createdAt: 1 });
  }

  async addToQueue(dto: CreateQueueEntryDto): Promise<{ entry: IPatient; transferredFromProfId?: string }> {
    if (!Types.ObjectId.isValid(dto.professionalId)) {
      throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
    }

    const dni = dto.patientDni || (dto as any).dni;
    const nombre = dto.patientFirstName || (dto as any).nombre || '';
    const apellido = dto.patientLastName || (dto as any).apellido || '';
    const obraSocial = dto.healthInsurance || (dto as any).obraSocial || 'Particular';

    let existing = await Patient.findOne({ dni });
    const ahora = new Date();
    const fechaStr = `${ahora.getDate()}/${ahora.getMonth() + 1}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

    if (existing) {
      const currentProfId = existing.profesionalId ? existing.profesionalId.toString() : '';
      let transferredFromProfId: string | undefined;

      if (currentProfId && currentProfId !== dto.professionalId) {
        logger.info(`[QueueService] Paciente transferido de ${currentProfId} a ${dto.professionalId}`);
        transferredFromProfId = currentProfId;

        // Registrar cambio de profesional
        existing.cambiosProfesional = existing.cambiosProfesional || [];
        existing.cambiosProfesional.push({
          fecha: ahora,
          fechaStr,
          profesionalAnterior: existing.profesional || currentProfId,
          profesionalNuevo: dto.professionalId,
        });
      }

      const totalVisitas = (existing.totalVisitas || existing.visitas?.length || 1) + 1;
      existing.totalVisitas = totalVisitas;

      existing.visitas = existing.visitas || [];
      existing.visitas.push({
        numeroVisita: totalVisitas,
        fecha: ahora,
        fechaStr,
        profesionalId: new Types.ObjectId(dto.professionalId),
        obraSocial,
        estado: QueueStatus.WAITING,
      });

      existing.profesionalId = new Types.ObjectId(dto.professionalId);
      existing.estado = QueueStatus.WAITING;
      existing.status = QueueStatus.WAITING;
      existing.nombre = nombre || existing.nombre;
      existing.apellido = apellido || existing.apellido;
      existing.obraSocial = obraSocial || existing.obraSocial;
      existing.joinedAt = ahora;
      existing.calledAt = undefined;
      existing.attentionStartedAt = undefined;
      existing.completedAt = undefined;
      existing.cancelledAt = undefined;

      await existing.save();
      return { entry: existing, transferredFromProfId };
    }

    const newPatient = await Patient.create({
      dni,
      nombre,
      apellido,
      obraSocial,
      profesionalId: new Types.ObjectId(dto.professionalId),
      estado: QueueStatus.WAITING,
      status: QueueStatus.WAITING,
      joinedAt: ahora,
      totalVisitas: 1,
      visitas: [
        {
          numeroVisita: 1,
          fecha: ahora,
          fechaStr,
          profesionalId: new Types.ObjectId(dto.professionalId),
          obraSocial,
          estado: QueueStatus.WAITING,
        }
      ],
      cambiosProfesional: [],
    });

    logger.info(`[QueueService] Paciente registrado en espera: ${newPatient._id}`);
    return { entry: newPatient };
  }

  async callPatient(patientId: string): Promise<IPatient> {
    const patient = await this.findPatient(patientId);
    patient.estado = QueueStatus.CALLED;
    patient.status = QueueStatus.CALLED;
    patient.calledAt = new Date();
    await patient.save();
    logger.info(`[QueueService] Paciente llamado: ${patient._id}`);
    return patient;
  }

  async startAttention(patientId: string): Promise<IPatient> {
    const patient = await this.findPatient(patientId);
    patient.estado = QueueStatus.IN_ATTENTION;
    patient.status = QueueStatus.IN_ATTENTION;
    patient.attentionStartedAt = new Date();
    await patient.save();
    logger.info(`[QueueService] Atención iniciada: ${patient._id}`);
    return patient;
  }

  async completeAttention(patientId: string): Promise<IPatient> {
    const patient = await this.findPatient(patientId);
    const ahora = new Date();

    patient.estado = QueueStatus.COMPLETED;
    patient.status = QueueStatus.COMPLETED;
    patient.completedAt = ahora;

    // Actualizar la última visita en el historial
    if (Array.isArray(patient.visitas) && patient.visitas.length > 0) {
      const ultima = patient.visitas[patient.visitas.length - 1];
      ultima.estado = QueueStatus.COMPLETED;
      ultima.atendidoAt = ahora;
      patient.markModified('visitas');
    }

    await patient.save();
    logger.info(`[QueueService] Atención completada: ${patient._id}`);
    return patient;
  }

  async cancelEntry(patientId: string): Promise<IPatient> {
    const patient = await this.findPatient(patientId);
    patient.estado = QueueStatus.CANCELLED;
    patient.status = QueueStatus.CANCELLED;
    patient.cancelledAt = new Date();

    if (Array.isArray(patient.visitas) && patient.visitas.length > 0) {
      const ultima = patient.visitas[patient.visitas.length - 1];
      ultima.estado = QueueStatus.CANCELLED;
      patient.markModified('visitas');
    }

    await patient.save();
    logger.info(`[QueueService] Entrada cancelada: ${patient._id}`);
    return patient;
  }

  private async findPatient(patientId: string): Promise<IPatient> {
    if (!Types.ObjectId.isValid(patientId)) {
      throw createError('ID de paciente inválido', 400, 'INVALID_PATIENT_ID');
    }
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw createError('Paciente no encontrado', 404, 'PATIENT_NOT_FOUND');
    }
    return patient;
  }
}

export const queueService = new QueueService();

