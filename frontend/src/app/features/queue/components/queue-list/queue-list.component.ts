import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
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

  completeAttention(entry: QueueEntry): void {
    this.queueService.completeAttention(entry._id);
  }

  cancelEntry(entry: QueueEntry): void {
    this.queueService.cancelEntry(entry._id);
  }

  formatTime(isoDate: string): string {
    return new Date(isoDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  minutesWaiting(isoDate: string): number {
    return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
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
