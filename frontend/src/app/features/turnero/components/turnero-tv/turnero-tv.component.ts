import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { QueueEntry, QueueStatus, Professional, QUEUE_EVENTS } from '../../../queue/models/queue.model';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { SocketService } from '../../../../core/services/socket.service';

export interface TvPatientRow {
  _id: string;
  patientFirstName: string;
  patientLastName: string;
  patientDni: string;
  healthInsurance: string;
  professionalName: string;
  professionalColor: string;
  office: string;
  joinedAt: string;
  joinedTime: string;
}

@Component({
  selector: 'app-turnero-tv',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './turnero-tv.component.html',
  styleUrl: './turnero-tv.component.scss'
})
export class TurneroTvComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);

  readonly allEntries = signal<QueueEntry[]>([]);
  readonly professionalsMap = signal<Map<string, Professional>>(new Map());
  readonly loading = signal<boolean>(true);
  readonly currentTime = signal<Date>(new Date());

  private socketCleanups: Array<() => void> = [];
  private clockInterval: any;
  private syncInterval: any;

  /** Filtra todos los pacientes en estado WAITING que tengan que atenderse en el día */
  readonly waitingPatients = computed<TvPatientRow[]>(() => {
    const profs = this.professionalsMap();
    const now = new Date();

    const todayIsoDate = now.toISOString().slice(0, 10);

    const isPatientForToday = (dStr: string) => {
      if (!dStr) return false;
      try {
        const entryIsoDate = new Date(dStr).toISOString().slice(0, 10);
        return entryIsoDate === todayIsoDate;
      } catch {
        return false;
      }
    };

    return this.allEntries()
      .filter(e => String(e.status).toUpperCase() === 'WAITING' && isPatientForToday(e.joinedAt))
      .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
      .map(entry => {
        const prof = profs.get(entry.professionalId);
        const profName = prof ? `${prof.firstName} ${prof.lastName}` : 'Profesional asignado';
        const profColor = prof?.colorTag || '#866385';
        const office = entry.office || prof?.office || 'Consultorio --';

        const dateObj = new Date(entry.joinedAt);
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const mins = String(dateObj.getMinutes()).padStart(2, '0');
        const joinedTime = `${hours}:${mins} hs`;

        return {
          _id: entry._id,
          patientFirstName: entry.patientFirstName,
          patientLastName: entry.patientLastName,
          patientDni: entry.patientDni,
          healthInsurance: entry.healthInsurance || 'Particular',
          professionalName: profName,
          professionalColor: profColor,
          office,
          joinedAt: entry.joinedAt,
          joinedTime,
        };
      });
  });

  async ngOnInit(): Promise<void> {
    await this.loadProfessionals();
    await this.loadQueue();
    this.setupSocket();

    // Reloj digital en vivo
    this.clockInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // Sincronización continua de respaldo cada 5 segundos
    this.syncInterval = setInterval(() => {
      this.loadQueue();
    }, 5000);
  }

  async loadProfessionals(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<Professional[]>>(`${environment.apiUrl}/professionals`)
      );
      if (res.success && res.data) {
        const map = new Map<string, Professional>();
        res.data.forEach(p => map.set(p._id, p));
        this.professionalsMap.set(map);
      }
    } catch (err) {
      console.error('[TurneroTv] Error cargando profesionales:', err);
    }
  }

  async loadQueue(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<QueueEntry[]>>(`${environment.apiUrl}/queue`)
      );
      if (res.success && res.data) {
        this.allEntries.set(res.data);
      }
    } catch (err) {
      console.error('[TurneroTv] Error cargando cola:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private setupSocket(): void {
    this.socketService.connect();
    this.socketService.joinTvRoom();

    // Cuando se agrega un paciente
    const offAdded = this.socketService.on<QueueEntry>(
      QUEUE_EVENTS.PATIENT_ADDED,
      (entry) => {
        this.allEntries.update(list => {
          if (list.some(e => e._id === entry._id)) {
            return list.map(e => e._id === entry._id ? { ...e, ...entry } : e);
          }
          return [...list, entry];
        });
      }
    );

    // Cuando un paciente es llamado (CALLED), inicia (IN_ATTENTION), completa o cancela
    const offUpdated = (event: string) => {
      return this.socketService.on<QueueEntry>(event, (updated) => {
        this.allEntries.update(list =>
          list.map(e => (e._id === updated._id ? { ...e, ...updated } : e))
        );
      });
    };

    const offCalled = offUpdated(QUEUE_EVENTS.PATIENT_CALLED);
    const offStarted = offUpdated(QUEUE_EVENTS.PATIENT_STARTED);
    const offCompleted = offUpdated(QUEUE_EVENTS.PATIENT_COMPLETED);
    const offCancelled = offUpdated(QUEUE_EVENTS.PATIENT_CANCELLED);

    this.socketCleanups = [offAdded, offCalled, offStarted, offCompleted, offCancelled];
  }

  get formattedDate(): string {
    const d = this.currentTime();
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  get formattedTime(): string {
    const d = this.currentTime();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  trackById(_: number, item: TvPatientRow): string {
    return item._id;
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.socketCleanups.forEach(cleanup => cleanup());
    this.socketService.leaveTvRoom();
  }
}
