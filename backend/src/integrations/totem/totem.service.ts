import type { Response } from 'express';
import { queueService, AddToQueueResult } from '../../modules/queue/queue.service';
import { QueueSource } from '../../modules/queue/queue.types';
import { Professional } from '../../modules/professionals/professional.model';
import { createError } from '../../middlewares/error.middleware';
import { TotemPatientRecord, TotemProfessionalSync } from './totem.types';
import { logger } from '../../utils/logger';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class TotemIntegrationService {
  private streamClients = new Set<Response>();

  /** Registra un cliente tótem escuchando eventos en tiempo real vía SSE */
  registerStreamClient(res: Response): () => void {
    this.streamClients.add(res);
    logger.info(`[TotemIntegration] Tótem conectado al stream en tiempo real (clientes: ${this.streamClients.size})`);
    return () => {
      this.streamClients.delete(res);
      logger.info(`[TotemIntegration] Tótem desconectado del stream (clientes: ${this.streamClients.size})`);
    };
  }

  /** Emite un evento SSE hacia todos los tótems conectados */
  private notifyStreamClients(eventName: string, payload: unknown): void {
    if (this.streamClients.size === 0) return;
    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.streamClients) {
      try {
        client.write(message);
      } catch {
        this.streamClients.delete(client);
      }
    }
  }

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
   * Avisa a los tótems conectados que cambió la lista de profesionales.
   * El turnero nunca llama al tótem: el tótem escucha este stream y vuelve a pedir la lista.
   * El evento no lleva datos (AGENTS.md §26, §58).
   */
  notifyProfessionalsUpdated(): void {
    this.notifyStreamClients('professionals-updated', {});
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
