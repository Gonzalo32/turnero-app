import mongoose, { Types } from 'mongoose';
import { Paciente } from '../patients/patient.model';
import { Professional } from '../professionals/professional.model';
import { Atencion, IAtencion } from '../atenciones/atencion.model';
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

/** Datos del paciente que necesita la cola (AGENTS.md §58) */
const PATIENT_FIELDS = 'dni nombre apellido';

export interface AddToQueueResult {
  entry: IAtencion;
  /** false si el paciente ya estaba activo con el mismo profesional (idempotencia) */
  created: boolean;
  /** Atención cancelada en otro profesional si el paciente fue transferido */
  transferredFrom?: IAtencion;
}

export class QueueService {

  /** Sincroniza entradas que el tótem haya insertado directamente en 'queueentries' */
  async syncLegacyQueueEntries(): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;
      const legacyEntries = await db.collection('queueentries').find({
        status: { $in: ACTIVE_QUEUE_STATUSES },
      }).toArray();

      for (const qe of legacyEntries) {
        const idOrigen = qe['sourceRecordId'] || qe['_id'].toString();
        const existing = await Atencion.findOne({ idOrigen });
        if (!existing) {
          const dni = qe['patientDni']?.trim() || 'SIN-DNI';
          const nombre = qe['patientFirstName']?.trim() || '';
          const apellido = qe['patientLastName']?.trim() || '';
          const patient = await Paciente.findOneAndUpdate(
            { dni },
            {
              $set: { nombre, apellido, obraSocial: qe['healthInsurance'] || 'Particular' },
              $setOnInsert: { sourceSystem: 'totem', sourcePatientId: idOrigen },
            },
            { upsert: true, new: true }
          );

          const entry = await Atencion.create({
            patientId: patient._id,
            professionalId: new Types.ObjectId(qe['professionalId']),
            fecha: qe['joinedAt'] ? new Date(qe['joinedAt']) : new Date(),
            estado: qe['status'] || QueueStatus.WAITING,
            consultorio: qe['office'] || '',
            obraSocial: qe['healthInsurance'] || 'Particular',
            numeroVisita: 1,
            origen: QueueSource.TOTEM,
            idOrigen,
          });
          await entry.populate('patientId', PATIENT_FIELDS);
          emitPatientAdded(entry);
          logger.info(`[QueueService] Sincronizado desde queueentries: ${nombre} ${apellido}`);
        }
      }
    } catch (err) {
      logger.warn('[QueueService] Error sincronizando queueentries legadas:', err);
    }
  }

  /** Cola activa ordenada por llegada; _id desempata (AGENTS.md §16) */
  async getActiveQueue(professionalId?: string): Promise<IAtencion[]> {
    await this.syncLegacyQueueEntries();

    const filter: Record<string, unknown> = { estado: { $in: ACTIVE_QUEUE_STATUSES } };

    if (professionalId) {
      if (!Types.ObjectId.isValid(professionalId)) {
        throw createError('ID de profesional inválido', 400, 'INVALID_PROFESSIONAL_ID');
      }
      filter['professionalId'] = new Types.ObjectId(professionalId);
    }

    return Atencion.find(filter).sort({ fecha: 1, _id: 1 }).populate('patientId', PATIENT_FIELDS);
  }

  /**
   * Ingresa un paciente a la cola. Emite eventos solo después de persistir (AGENTS.md §22).
   * - Crea o actualiza el paciente por DNI.
   * - Si ya está activo con el mismo profesional, no duplica.
   * - Si está activo con otro profesional, cancela esa atención (transferencia).
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
    const obraSocialRecibida = dto.healthInsurance?.trim() || undefined;

    // Solo se pisan los datos que llegaron; un alta manual no borra lo que cargó el tótem.
    const details = {
      nombre,
      apellido,
      obraSocial: obraSocialRecibida,
      telefono: dto.telefono,
      fechaNacimiento: dto.fechaNacimiento,
      numeroAfiliado: dto.numeroAfiliado,
      localidad: dto.localidad,
      domicilio: dto.domicilio,
      observacion: dto.observacion,
    };
    const $set = Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined));

    const patient = await Paciente.findOneAndUpdate(
      { dni },
      {
        $set,
        $setOnInsert: dto.sourceRecordId ? { sourceSystem: source, sourcePatientId: dto.sourceRecordId } : {},
      },
      { upsert: true, new: true }
    );

    // ponytail: chequeo en el service, no índice único; dos llegadas simultáneas del mismo paciente
    // podrían duplicar. Agregar índice único parcial si ocurre en la práctica.
    const active = await Atencion.findOne({ patientId: patient._id, estado: { $in: ACTIVE_QUEUE_STATUSES } })
      .populate('patientId', PATIENT_FIELDS);
    if (active && active.professionalId.equals(professionalId)) {
      logger.info(`[QueueService] Paciente ${patient._id} ya activo con el profesional, ignorado (idempotencia)`);
      return { entry: active, created: false };
    }

    let transferredFrom: IAtencion | undefined;
    if (active) {
      active.estado = QueueStatus.CANCELLED;
      active.canceladoAt = new Date();
      transferredFrom = await active.save();
      emitPatientCancelled(transferredFrom);
      logger.info(`[QueueService] Paciente ${patient._id} transferido de ${active.professionalId} a ${professionalId}`);
    }

    const obraSocial = obraSocialRecibida ?? patient.obraSocial ?? 'Particular';
    const prof = await Professional.findById(professionalId);
    const consultorio = dto.office?.trim() || prof?.office || '';

    const previousVisits = await Atencion.countDocuments({ patientId: patient._id });
    const entry = await Atencion.create({
      patientId: patient._id,
      professionalId,
      fecha: new Date(),
      estado: QueueStatus.WAITING,
      consultorio,
      obraSocial,
      numeroVisita: previousVisits + 1,
      origen: source,
      idOrigen: dto.sourceRecordId,
    });
    await entry.populate('patientId', PATIENT_FIELDS);

    emitPatientAdded(entry);
    logger.info(`[QueueService] Atención creada: ${entry._id} (visita #${entry.numeroVisita}) en ${consultorio || 'sin consultorio'}`);
    return { entry, created: true, transferredFrom };
  }

  async callPatient(entryId: string): Promise<IAtencion> {
    const entry = await this.findActiveEntry(entryId);
    entry.estado = QueueStatus.CALLED;
    entry.llamadoAt = new Date();
    const saved = await entry.save();
    emitPatientCalled(saved);
    return saved;
  }

  async startAttention(entryId: string): Promise<IAtencion> {
    const entry = await this.findActiveEntry(entryId);
    entry.estado = QueueStatus.IN_ATTENTION;
    entry.inicioAtencionAt = new Date();
    const saved = await entry.save();
    emitPatientStarted(saved);
    return saved;
  }

  async completeAttention(entryId: string): Promise<IAtencion> {
    const entry = await this.findActiveEntry(entryId);
    entry.estado = QueueStatus.COMPLETED;
    entry.finalizadoAt = new Date();
    const saved = await entry.save();
    emitPatientCompleted(saved);
    return saved;
  }

  async cancelEntry(entryId: string): Promise<IAtencion> {
    const entry = await this.findActiveEntry(entryId);
    entry.estado = QueueStatus.CANCELLED;
    entry.canceladoAt = new Date();
    const saved = await entry.save();
    emitPatientCancelled(saved);
    return saved;
  }

  /** Las transiciones solo aplican a atenciones que siguen en la cola */
  private async findActiveEntry(entryId: string): Promise<IAtencion> {
    if (!Types.ObjectId.isValid(entryId)) {
      throw createError('ID de entrada inválido', 400, 'INVALID_QUEUE_ENTRY_ID');
    }
    const entry = await Atencion.findById(entryId).populate('patientId', PATIENT_FIELDS);
    if (!entry) {
      throw createError('Entrada de cola no encontrada', 404, 'QUEUE_ENTRY_NOT_FOUND');
    }
    if (!ACTIVE_QUEUE_STATUSES.includes(entry.estado)) {
      throw createError('La entrada ya no está en la cola', 409, 'QUEUE_ENTRY_NOT_ACTIVE');
    }
    return entry;
  }
}

export const queueService = new QueueService();
