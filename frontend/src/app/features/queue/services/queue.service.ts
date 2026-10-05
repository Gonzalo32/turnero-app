import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  QueueEntry,
  QueueStatus,
  Professional,
  QUEUE_EVENTS,
  AddToQueueDto,
} from '../models/queue.model';
import { ApiResponse } from '../../../core/models/api-response.model';
import { SocketService } from '../../../core/services/socket.service';
import { logger } from '../../../core/utils/logger';

/**
 * Servicio de la feature queue.
 * AGENTS.md §40: Los componentes no hacen HTTP directamente.
 * AGENTS.md §41: Socket.IO centralizado en SocketService; este servicio se suscribe a eventos.
 * AGENTS.md §24: Al reconectar, recupera el estado actual vía API.
 */
@Injectable({ providedIn: 'root' })
export class QueueService implements OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);

  private readonly apiBase = `${environment.apiUrl}/queue`;
  private readonly profApiBase = `${environment.apiUrl}/professionals`;

  /** Cola activa en tiempo real */
  readonly entries = signal<QueueEntry[]>([]);

  /** Lista de profesionales (cargada desde API, no hardcodeada) */
  readonly professionals = signal<Professional[]>([]);

  /** Estado de conexión Socket.IO reactivo */
  readonly socketConnected = this.socketService.connected;

  /** ID del último turno nuevo (para animaciones) */
  readonly lastNewEntryId = signal<string | null>(null);

  private socketCleanups: Array<() => void> = [];

  // ── Profesionales ──────────────────────────────────────────────────────────

  /** Carga la lista de profesionales activos desde la API */
  async loadProfessionals(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<Professional[]>>(this.profApiBase)
      );
      if (response.success && response.data) {
        this.professionals.set(response.data);
      }
    } catch (error) {
      logger.error('[QueueService] Error cargando profesionales:', error);
    }
  }

  // ── Cola ───────────────────────────────────────────────────────────────────

  /**
   * Carga la cola activa desde la API para un profesional específico.
   * Usado al conectar/reconectar (AGENTS.md §24).
   */
  async loadQueue(professionalId: string): Promise<void> {
    try {
      const url = `${this.apiBase}?professionalId=${encodeURIComponent(professionalId)}`;
      const response = await firstValueFrom(
        this.http.get<ApiResponse<QueueEntry[]>>(url)
      );
      if (response.success && response.data) {
        this.entries.set(response.data);
      }
    } catch (error) {
      logger.error('[QueueService] Error cargando cola:', error);
    }
  }

  /** Agrega manualmente un paciente a la cola */
  async addToQueue(dto: AddToQueueDto): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<ApiResponse<QueueEntry>>(this.apiBase, dto)
      );
      // El evento Socket.IO actualizará la lista en tiempo real
    } catch (error) {
      logger.error('[QueueService] Error agregando a la cola:', error);
      throw error;
    }
  }

  /** Llama a un paciente (WAITING → CALLED) */
  async callPatient(entryId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch<ApiResponse<QueueEntry>>(`${this.apiBase}/${entryId}/call`, {})
      );
    } catch (error) {
      logger.error('[QueueService] Error llamando paciente:', error);
      throw error;
    }
  }

  /** Completa la atención de un paciente */
  async completeAttention(entryId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch<ApiResponse<QueueEntry>>(`${this.apiBase}/${entryId}/complete`, {})
      );
      // Actualización optimista: remover de la lista local
      this.entries.update(list => list.filter(e => e._id !== entryId));
    } catch (error) {
      logger.error('[QueueService] Error completando atención:', error);
      throw error;
    }
  }

  /** Cancela una entrada de la cola */
  async cancelEntry(entryId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch<ApiResponse<QueueEntry>>(`${this.apiBase}/${entryId}/cancel`, {})
      );
      this.entries.update(list => list.filter(e => e._id !== entryId));
    } catch (error) {
      logger.error('[QueueService] Error cancelando entrada:', error);
      throw error;
    }
  }

  // ── Socket.IO ──────────────────────────────────────────────────────────────

  /**
   * Conecta Socket.IO y suscribe a los eventos de cola para el profesional.
   * AGENTS.md §24: Si se reconecta, recupera estado actual desde API.
   */
  connectSocket(professionalId: string): void {
    this.socketService.connect();
    this.socketService.joinProfessionalRoom(professionalId);

    // Evento: paciente agregado (aislado al profesional)
    const offAdded = this.socketService.on<QueueEntry>(
      QUEUE_EVENTS.PATIENT_ADDED,
      (entry) => {
        if (entry.professionalId !== professionalId) return;

        this.entries.update(list => {
          if (list.some(e => e._id === entry._id)) return list;
          this.triggerNewEntryAnimation(entry._id);
          return [...list, entry];
        });
      }
    );

    // Evento: paciente llamado → actualizar estado en lista
    const offCalled = this.socketService.on<QueueEntry>(
      QUEUE_EVENTS.PATIENT_CALLED,
      (entry) => {
        if (entry.professionalId !== professionalId) return;
        this.updateEntryInList(entry);
      }
    );

    // Evento: atención iniciada → actualizar estado
    const offStarted = this.socketService.on<QueueEntry>(
      QUEUE_EVENTS.PATIENT_STARTED,
      (entry) => {
        if (entry.professionalId !== professionalId) return;
        this.updateEntryInList(entry);
      }
    );

    // Evento: atención completada → remover de lista
    const offCompleted = this.socketService.on<QueueEntry>(
      QUEUE_EVENTS.PATIENT_COMPLETED,
      (entry) => this.entries.update(list => list.filter(e => e._id !== entry._id))
    );

    // Evento: cancelada → remover de lista
    const offCancelled = this.socketService.on<QueueEntry>(
      QUEUE_EVENTS.PATIENT_CANCELLED,
      (entry) => this.entries.update(list => list.filter(e => e._id !== entry._id))
    );

    // Sincronización continua de respaldo cada 15s con la base de datos
    const syncInterval = setInterval(() => {
      if (this.socketConnected()) {
        this.loadQueue(professionalId);
      }
    }, 15000);

    const cleanupInterval = () => clearInterval(syncInterval);

    this.socketCleanups = [offAdded, offCalled, offStarted, offCompleted, offCancelled, cleanupInterval];
  }

  /** Desconecta Socket.IO limpiamente */
  disconnectSocket(): void {
    this.socketCleanups.forEach(cleanup => cleanup());
    this.socketCleanups = [];
    this.socketService.leaveProfessionalRoom();
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private updateEntryInList(updated: QueueEntry): void {
    this.entries.update(list =>
      list.map(e => (e._id === updated._id ? { ...e, ...updated } : e))
    );
  }

  private triggerNewEntryAnimation(entryId: string): void {
    this.lastNewEntryId.set(entryId);
    this.playAlertSound();
    setTimeout(() => this.lastNewEntryId.set(null), 3000);
  }

  private playAlertSound(): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Web Audio API puede no estar disponible
    }
  }

  ngOnDestroy(): void {
    this.disconnectSocket();
  }
}
