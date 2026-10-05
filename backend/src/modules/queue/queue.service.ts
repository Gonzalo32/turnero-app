import { Types } from 'mongoose';
import { Patient } from '../patients/patient.model';
import { QueueEntry, IQueueEntry } from './queue.model';
import { QueueStatus, QueueSource, CreateQueueEntryDto, ACTIVE_QUEUE_STATUSES } from './queue.types';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';
import {
  emitPatientAdded,
  emitPatientCalled,
  emitPatientStarted,
  emitPatientCompleted,
  emitPatientCancelled,
} from './queue.socket';

export interface AddToQueueResult {
  entry: IQueueEntry;
  /** false si el paciente ya estaba activo con el mismo profesional (idempotencia) */
  created: boolean;
  /** Entrada cancelada en otro profesional si el paciente fue transferido */
  transferredFrom?: IQueueEntry;
}

export class QueueService {

  /** Cola activa ordenada por llegada; _id desempata (AGENTS.md §16) */
  async getActiveQueue(professionalId?: string): Promise<IQueueEntry[]> {
    const filter: Record<string, unknown> = { status: { $in: ACTIVE_QUEUE_STATUSES } };

    if (professionalId) {
      if (!Types.ObjectId.isValid(professionalId)) {
        throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
      }
      filter['professionalId'] = new Types.ObjectId(professionalId);
    }

    return QueueEntry.find(filter).sort({ joinedAt: 1, _id: 1 });
  }

  /**
   * Ingresa un paciente a la cola. Emite eventos solo después de persistir (AGENTS.md §22).
   * - Crea o actualiza el paciente por DNI.
   * - Si ya está activo con el mismo profesional, no duplica.
   * - Si está activo con otro profesional, cancela esa entrada (transferencia).
   */
  async addToQueue(dto: CreateQueueEntryDto): Promise<AddToQueueResult> {
    const dni = dto.patientDni?.trim();
    const nombre = dto.patientFirstName?.trim();
    const apellido = dto.patientLastName?.trim();
    if (!dni || !nombre || !apellido) {
      throw createError('DNI, nombre y apellido son requeridos', 400, 'INVALID_QUEUE_ENTRY');
    }
    if (!Types.ObjectId.isValid(dto.professionalId)) {
      throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
    }
    const professionalId = new Types.ObjectId(dto.professionalId);
    const source = dto.source ?? QueueSource.MANUAL;

    const patient = await Patient.findOneAndUpdate(
      { dni },
      {
        $set: { nombre, apellido },
        $setOnInsert: dto.sourceRecordId ? { sourceSystem: source, sourcePatientId: dto.sourceRecordId } : {},
      },
      { upsert: true, new: true }
    );

    // ponytail: chequeo en el service, no índice único; dos llegadas simultáneas del mismo paciente
    // podrían duplicar. Agregar índice único parcial si ocurre en la práctica.
    const active = await QueueEntry.findOne({ patientId: patient._id, status: { $in: ACTIVE_QUEUE_STATUSES } });
    if (active && active.professionalId.equals(professionalId)) {
      logger.info(`[QueueService] Paciente ${patient._id} ya activo con el profesional, ignorado (idempotencia)`);
      return { entry: active, created: false };
    }

    let transferredFrom: IQueueEntry | undefined;
    if (active) {
      active.status = QueueStatus.CANCELLED;
      active.cancelledAt = new Date();
      transferredFrom = await active.save();
      emitPatientCancelled(transferredFrom);
      logger.info(`[QueueService] Paciente ${patient._id} transferido de ${active.professionalId} a ${professionalId}`);
    }

    const previousVisits = await QueueEntry.countDocuments({ patientId: patient._id });
    const entry = await QueueEntry.create({
      patientId: patient._id,
      patientFirstName: nombre,
      patientLastName: apellido,
      patientDni: dni,
      healthInsurance: dto.healthInsurance?.trim() || 'Particular',
      professionalId,
      status: QueueStatus.WAITING,
      source,
      sourceRecordId: dto.sourceRecordId,
      visitNumber: previousVisits + 1,
      joinedAt: new Date(),
    });

    emitPatientAdded(entry);
    logger.info(`[QueueService] Entrada creada: ${entry._id} (visita #${entry.visitNumber})`);
    return { entry, created: true, transferredFrom };
  }

  async callPatient(entryId: string): Promise<IQueueEntry> {
    const entry = await this.findActiveEntry(entryId);
    entry.status = QueueStatus.CALLED;
    entry.calledAt = new Date();
    const saved = await entry.save();
    emitPatientCalled(saved);
    return saved;
  }

  async startAttention(entryId: string): Promise<IQueueEntry> {
    const entry = await this.findActiveEntry(entryId);
    entry.status = QueueStatus.IN_ATTENTION;
    entry.attentionStartedAt = new Date();
    const saved = await entry.save();
    emitPatientStarted(saved);
    return saved;
  }

  async completeAttention(entryId: string): Promise<IQueueEntry> {
    const entry = await this.findActiveEntry(entryId);
    entry.status = QueueStatus.COMPLETED;
    entry.completedAt = new Date();
    const saved = await entry.save();
    emitPatientCompleted(saved);
    return saved;
  }

  async cancelEntry(entryId: string): Promise<IQueueEntry> {
    const entry = await this.findActiveEntry(entryId);
    entry.status = QueueStatus.CANCELLED;
    entry.cancelledAt = new Date();
    const saved = await entry.save();
    emitPatientCancelled(saved);
    return saved;
  }

  /** Las transiciones solo aplican a entradas que siguen en la cola */
  private async findActiveEntry(entryId: string): Promise<IQueueEntry> {
    if (!Types.ObjectId.isValid(entryId)) {
      throw createError('ID de entrada inválido', 400, 'INVALID_QUEUE_ENTRY_ID');
    }
    const entry = await QueueEntry.findById(entryId);
    if (!entry) {
      throw createError('Entrada de cola no encontrada', 404, 'QUEUE_ENTRY_NOT_FOUND');
    }
    if (!ACTIVE_QUEUE_STATUSES.includes(entry.status)) {
      throw createError('La entrada ya no está en la cola', 409, 'QUEUE_ENTRY_NOT_ACTIVE');
    }
    return entry;
  }
}

export const queueService = new QueueService();
