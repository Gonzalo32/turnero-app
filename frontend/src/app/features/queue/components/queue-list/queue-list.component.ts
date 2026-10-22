import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueService } from '../../services/queue.service';
import { QueueEntry, QueueStatus } from '../../models/queue.model';
import { SessionService } from '../../../../core/services/session.service';

@Component({
  selector: 'app-queue-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './queue-list.component.html'
})
export class QueueListComponent implements OnInit, OnDestroy {
  private queueService = inject(QueueService);
  private session = inject(SessionService);

  readonly entries = this.queueService.entries;
  readonly socketConnected = this.queueService.socketConnected;
  readonly lastNewEntryId = this.queueService.lastNewEntryId;
  readonly totalWaiting = computed(() => this.entries().length);
  readonly QueueStatus = QueueStatus;

  /**
   * Ordena las tarjetas del odontólogo:
   * 1. IN_ATTENTION (atendiéndose en el sillón)
   * 2. CALLED (llamado para ingresar)
   * 3. WAITING (en espera por orden de llegada)
   */
  readonly sortedEntries = computed(() => {
    const statusRank: Record<QueueStatus, number> = {
      [QueueStatus.IN_ATTENTION]: 1,
      [QueueStatus.CALLED]: 2,
      [QueueStatus.WAITING]: 3,
      [QueueStatus.COMPLETED]: 4,
      [QueueStatus.CANCELLED]: 5,
    };

    return [...this.entries()].sort((a, b) => {
      const rankA = statusRank[a.status] ?? 99;
      const rankB = statusRank[b.status] ?? 99;
      if (rankA !== rankB) return rankA - rankB;

      if (a.status === QueueStatus.CALLED && b.status === QueueStatus.CALLED) {
        const timeA = a.calledAt ? new Date(a.calledAt).getTime() : 0;
        const timeB = b.calledAt ? new Date(b.calledAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
      }

      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
  });

  /** Previene doble clic mientras se procesa la acción */
  readonly processingId = signal<string | null>(null);

  ngOnInit(): void {
    const profId = this.session.professional()?._id;
    if (!profId) return;

    // 1. Cargar cola actual desde API
    this.queueService.loadQueue(profId);
    // 2. Conectar Socket.IO
    this.queueService.connectSocket(profId);
  }

  ngOnDestroy(): void {
    this.queueService.disconnectSocket();
  }

  /**
   * Botón dinámico según el ciclo de vida del paciente:
   * 1. WAITING -> "Llamar": cambia a CALLED, sube al tope y resalta en turnero-tv.
   * 2. CALLED -> "En atención": cambia a IN_ATTENTION y se oculta en turnero-tv.
   * 3. IN_ATTENTION -> "Completado": cambia a COMPLETED y se remueve de cola de pacientes.
   */
  async handlePrimaryAction(entry: QueueEntry): Promise<void> {
    if (this.processingId() === entry._id) return;
    this.processingId.set(entry._id);

    try {
      if (entry.status === QueueStatus.WAITING) {
        await this.queueService.callPatient(entry._id);
        setTimeout(() => {
          try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch {}
        }, 50);
      } else if (entry.status === QueueStatus.CALLED) {
        await this.queueService.startAttention(entry._id);
      } else if (entry.status === QueueStatus.IN_ATTENTION) {
        await this.queueService.completeAttention(entry._id);
      }
    } catch (error) {
      console.error('[QueueList] Error ejecutando acción de cola:', error);
    } finally {
      this.processingId.set(null);
    }
  }

  /** Permite re-llamar al paciente si ya estaba en estado CALLED */
  async reCallPatient(entry: QueueEntry, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    if (this.processingId() === entry._id) return;
    this.processingId.set(entry._id);

    try {
      await this.queueService.callPatient(entry._id);
    } catch (error) {
      console.error('[QueueList] Error al re-llamar paciente:', error);
    } finally {
      this.processingId.set(null);
    }
  }

  async cancelEntry(entry: QueueEntry): Promise<void> {
    if (this.processingId() === entry._id) return;
    this.processingId.set(entry._id);

    try {
      await this.queueService.cancelEntry(entry._id);
    } catch (error) {
      console.error('[QueueList] Error cancelando entrada:', error);
    } finally {
      this.processingId.set(null);
    }
  }

  formatTime(isoDate: string): string {
    return new Date(isoDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  minutesWaiting(isoDate: string): number {
    return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  }

  isUrgent(isoDate: string): boolean {
    return this.minutesWaiting(isoDate) >= 15;
  }

  trackByEntryId(_: number, e: QueueEntry): string { return e._id; }

  statusLabel(status: QueueStatus): string {
    const map: Record<QueueStatus, string> = {
      [QueueStatus.WAITING]: 'Esperando',
      [QueueStatus.CALLED]: 'Llamado',
      [QueueStatus.IN_ATTENTION]: 'En atención',
      [QueueStatus.COMPLETED]: 'Completado',
      [QueueStatus.CANCELLED]: 'Cancelado',
    };
    return map[status] ?? status;
  }
}
