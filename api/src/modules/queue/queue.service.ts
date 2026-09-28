import { Types } from 'mongoose';
import { QueueEntry, IQueueEntry } from './queue.model';
import { QueueStatus, QueueSource, CreateQueueEntryDto } from './queue.types';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';

/**
 * Servicio de cola de espera.
 * Contiene TODA la lógica de negocio del módulo queue (AGENTS.md §33).
 * Los controllers son solo adaptadores HTTP → este service.
 */
export class QueueService {

  /**
   * Obtiene la cola activa (WAITING/CALLED/IN_ATTENTION).
   * Opcionalmente filtra por profesional.
   * Orden: joinedAt ASC (primero en llegar, primero en ser atendido).
   */
  async getActiveQueue(professionalId?: string): Promise<IQueueEntry[]> {
    const filter: Record<string, unknown> = {
      status: { $in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_ATTENTION] },
    };

    if (professionalId) {
      if (!Types.ObjectId.isValid(professionalId)) {
        throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
      }
      filter['professionalId'] = new Types.ObjectId(professionalId);
    }

    return QueueEntry
      .find(filter)
      .sort({ joinedAt: 1 })
      .lean<IQueueEntry[]>();
  }

  /**
   * Agrega un paciente a la cola.
   *
   * Regla idempotencia (AGENTS.md §25): si ya existe una entrada WAITING/CALLED
   * para el mismo sourceRecordId, no crea duplicado.
   *
   * Orden obligatorio (AGENTS.md §22):
   * 1. Validar → 2. Lógica → 3. Persistir → 4. Confirmar → 5. Emitir evento
   */
  async addToQueue(dto: CreateQueueEntryDto): Promise<IQueueEntry> {
    // Idempotencia: detectar entrada duplicada del tótem
    if (dto.sourceRecordId) {
      const existing = await QueueEntry.findOne({
        sourceRecordId: dto.sourceRecordId,
        status: { $in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_ATTENTION] },
      });

      if (existing) {
        logger.warn(`[QueueService] Entrada duplicada ignorada: sourceRecordId=${dto.sourceRecordId}`);
        return existing;
      }
    }

    if (!Types.ObjectId.isValid(dto.professionalId)) {
      throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
    }

    const entry = await QueueEntry.create({
      patientFirstName: dto.patientFirstName,
      patientLastName: dto.patientLastName,
      patientDni: dto.patientDni,
      healthInsurance: dto.healthInsurance ?? 'Particular',
      professionalId: new Types.ObjectId(dto.professionalId),
      status: QueueStatus.WAITING,
      source: dto.source ?? QueueSource.MANUAL,
      sourceRecordId: dto.sourceRecordId,
      joinedAt: new Date(),
    });

    logger.info(`[QueueService] Paciente agregado a la cola: ${entry._id}`);
    return entry;
  }

  /**
   * Llama al siguiente paciente (WAITING → CALLED).
   */
  async callPatient(entryId: string): Promise<IQueueEntry> {
    const entry = await this.findActiveEntry(entryId);

    if (entry.status !== QueueStatus.WAITING) {
      throw createError(
        `No se puede llamar un paciente en estado ${entry.status}`,
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    entry.status = QueueStatus.CALLED;
    entry.calledAt = new Date();
    await entry.save();

    logger.info(`[QueueService] Paciente llamado: ${entry._id}`);
    return entry;
  }

  /**
   * Inicia la atención (CALLED → IN_ATTENTION).
   */
  async startAttention(entryId: string): Promise<IQueueEntry> {
    const entry = await this.findActiveEntry(entryId);

    if (entry.status !== QueueStatus.CALLED) {
      throw createError(
        `No se puede iniciar atención desde estado ${entry.status}`,
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    entry.status = QueueStatus.IN_ATTENTION;
    entry.attentionStartedAt = new Date();
    await entry.save();

    logger.info(`[QueueService] Atención iniciada: ${entry._id}`);
    return entry;
  }

  /**
   * Completa la atención (IN_ATTENTION | CALLED | WAITING → COMPLETED).
   */
  async completeAttention(entryId: string): Promise<IQueueEntry> {
    const entry = await this.findActiveEntry(entryId);

    entry.status = QueueStatus.COMPLETED;
    entry.completedAt = new Date();
    await entry.save();

    logger.info(`[QueueService] Atención completada: ${entry._id}`);
    return entry;
  }

  /**
   * Cancela una entrada de la cola.
   */
  async cancelEntry(entryId: string): Promise<IQueueEntry> {
    const entry = await this.findActiveEntry(entryId);

    if (entry.status === QueueStatus.COMPLETED || entry.status === QueueStatus.CANCELLED) {
      throw createError(
        `No se puede cancelar una entrada en estado ${entry.status}`,
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    entry.status = QueueStatus.CANCELLED;
    entry.cancelledAt = new Date();
    await entry.save();

    logger.info(`[QueueService] Entrada cancelada: ${entry._id}`);
    return entry;
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async findActiveEntry(entryId: string): Promise<IQueueEntry> {
    if (!Types.ObjectId.isValid(entryId)) {
      throw createError('ID de entrada inválido', 400, 'INVALID_ENTRY_ID');
    }

    const entry = await QueueEntry.findById(entryId);
    if (!entry) {
      throw createError('Entrada de cola no encontrada', 404, 'QUEUE_ENTRY_NOT_FOUND');
    }

    return entry;
  }
}

export const queueService = new QueueService();
