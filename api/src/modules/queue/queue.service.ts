import { Types } from 'mongoose';
import { Patient, IPaciente } from '../patients/patient.model';
import { Atencion, IAtencionDocument, IAtencionItem } from '../atenciones/atencion.model';
import { QueueStatus, QueueSource, CreateQueueEntryDto } from './queue.types';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';

export interface IQueueItem {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  dni: string;
  nombre: string;
  apellido: string;
  obraSocial: string;
  profesional?: string;
  profesionalId: Types.ObjectId;
  estado: QueueStatus | string;
  status: QueueStatus | string;
  fecha: Date;
  joinedAt: Date;
}

export class QueueService {

  async getActiveQueue(professionalId?: string): Promise<IQueueItem[]> {
    const filter: Record<string, unknown> = {
      estado: { $in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_ATTENTION] },
    };

    if (professionalId) {
      if (!Types.ObjectId.isValid(professionalId)) {
        throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
      }
      filter.professionalId = new Types.ObjectId(professionalId);
    }

    const docs = await Atencion.find(filter)
      .populate('patientId')
      .sort({ fecha: 1 });

    return docs.map((doc) => {
      const p = (doc.patientId as any) || {};
      return {
        _id: doc._id,
        patientId: p._id || doc.patientId,
        dni: p.dni || '',
        nombre: p.nombre || '',
        apellido: p.apellido || '',
        obraSocial: p.obraSocial || 'Particular',
        profesional: p.profesional,
        profesionalId: doc.professionalId,
        estado: doc.estado,
        status: doc.estado,
        fecha: doc.fecha,
        joinedAt: doc.fecha,
      };
    });
  }

  async addToQueue(dto: CreateQueueEntryDto): Promise<{ entry: IQueueItem; transferredFromProfId?: string }> {
    if (!Types.ObjectId.isValid(dto.professionalId)) {
      throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
    }

    const dni = dto.patientDni || (dto as any).dni;
    const nombre = dto.patientFirstName || (dto as any).nombre || '';
    const apellido = dto.patientLastName || (dto as any).apellido || '';
    const obraSocial = dto.healthInsurance || (dto as any).obraSocial || 'Particular';

    let patient = await Patient.findOne({ dni });
    if (!patient) {
      patient = await Patient.create({
        dni,
        nombre,
        apellido,
        obraSocial,
      });
      logger.info(`[QueueService] Nuevo paciente creado en 'pacientes': ${patient.dni}`);
    } else {
      patient.nombre = nombre || patient.nombre;
      patient.apellido = apellido || patient.apellido;
      patient.obraSocial = obraSocial || patient.obraSocial;
      await patient.save();
    }

    const ahora = new Date();
    const professionalId = new Types.ObjectId(dto.professionalId);

    // Crear la consulta/atención individual en la colección 'atenciones'
    const doc = await Atencion.create({
      patientId: patient._id,
      professionalId,
      fecha: ahora,
      estado: QueueStatus.WAITING,
    });

    const entry: IQueueItem = {
      _id: doc._id,
      patientId: patient._id,
      dni: patient.dni,
      nombre: patient.nombre,
      apellido: patient.apellido,
      obraSocial: patient.obraSocial || 'Particular',
      profesional: patient.profesional,
      profesionalId: professionalId,
      estado: doc.estado,
      status: doc.estado,
      fecha: doc.fecha,
      joinedAt: doc.fecha,
    };

    logger.info(`[QueueService] Atención individual creada en 'atenciones': ${doc._id} para DNI ${dni}`);
    return { entry };
  }

  async callPatient(itemId: string): Promise<IQueueItem> {
    await this.updateItemStatus(itemId, QueueStatus.CALLED);
    logger.info(`[QueueService] Paciente llamado: ${itemId}`);
    return this.findQueueItem(itemId);
  }

  async startAttention(itemId: string): Promise<IQueueItem> {
    await this.updateItemStatus(itemId, QueueStatus.IN_ATTENTION);
    logger.info(`[QueueService] Atención iniciada: ${itemId}`);
    return this.findQueueItem(itemId);
  }

  async completeAttention(itemId: string): Promise<IQueueItem> {
    await this.updateItemStatus(itemId, QueueStatus.COMPLETED);
    logger.info(`[QueueService] Atención completada: ${itemId}`);
    return this.findQueueItem(itemId);
  }

  async cancelEntry(itemId: string): Promise<IQueueItem> {
    await this.updateItemStatus(itemId, QueueStatus.CANCELLED);
    logger.info(`[QueueService] Atención cancelada: ${itemId}`);
    return this.findQueueItem(itemId);
  }

  private async updateItemStatus(itemId: string, status: QueueStatus): Promise<void> {
    if (!Types.ObjectId.isValid(itemId)) {
      throw createError('ID de atención inválido', 400, 'INVALID_ATTENTION_ID');
    }
    const res = await Atencion.findByIdAndUpdate(itemId, { estado: status });
    if (!res) {
      throw createError('Atención no encontrada', 404, 'ATTENTION_NOT_FOUND');
    }
  }

  private async findQueueItem(itemId: string): Promise<IQueueItem> {
    if (!Types.ObjectId.isValid(itemId)) {
      throw createError('ID de atención inválido', 400, 'INVALID_ATTENTION_ID');
    }
    const doc = await Atencion.findById(itemId).populate('patientId');
    if (!doc) {
      throw createError('Atención no encontrada', 404, 'ATTENTION_NOT_FOUND');
    }
    const p = (doc.patientId as any) || {};
    return {
      _id: doc._id,
      patientId: p._id || doc.patientId,
      dni: p.dni || '',
      nombre: p.nombre || '',
      apellido: p.apellido || '',
      obraSocial: p.obraSocial || 'Particular',
      profesional: p.profesional,
      profesionalId: doc.professionalId,
      estado: doc.estado,
      status: doc.estado,
      fecha: doc.fecha,
      joinedAt: doc.fecha,
    };
  }
}

export const queueService = new QueueService();
