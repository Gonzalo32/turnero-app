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
  status: QueueStatus;
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

  /** Pacientes recientemente llamados para resaltar visualmente en TV */
  readonly recentlyCalledIds = signal<Set<string>>(new Set());
  private callTimeouts = new Map<string, any>();

  private socketCleanups: Array<() => void> = [];
  private clockInterval: any;
  private syncInterval: any;

  /**
   * Pacientes en sala de espera hoy:
   * Incluye WAITING y CALLED.
   * Al pasar a IN_ATTENTION, COMPLETED o CANCELLED se oculta de la pantalla sin borrar datos.
   */
  readonly waitingPatients = computed<TvPatientRow[]>(() => {
    const profs = this.professionalsMap();
    const now = new Date();

    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayIsoDate = now.toISOString().slice(0, 10);

    const isPatientForToday = (dStr: string) => {
      if (!dStr) return false;
      try {
        const d = new Date(dStr);
        // Si el paciente llegó en las últimas 24 horas, siempre se considera de la jornada actual
        const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
        if (diffHours >= 0 && diffHours < 24) return true;

        const entryLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const entryIsoDate = d.toISOString().slice(0, 10);
        return entryLocal === todayLocal || entryIsoDate === todayIsoDate;
      } catch {
        return false;
      }
    };

    const visibleStatuses = [QueueStatus.WAITING, QueueStatus.CALLED];
    const calledIds = this.recentlyCalledIds();

    return this.allEntries()
      .filter(e => visibleStatuses.includes(e.status as QueueStatus) && isPatientForToday(e.joinedAt))
      .sort((a, b) => {
        // 1. Pacientes recientemente llamados (durante los segundos de resaltado) al tope absoluto
        const aRecent = calledIds.has(a._id);
        const bRecent = calledIds.has(b._id);
        if (aRecent && !bRecent) return -1;
        if (!aRecent && bRecent) return 1;

        // 2. Pacientes con estado CALLED antes que WAITING
        const aCalled = a.status === QueueStatus.CALLED;
        const bCalled = b.status === QueueStatus.CALLED;
        if (aCalled && !bCalled) return -1;
        if (!aCalled && bCalled) return 1;

        // Si ambos están en CALLED, el más recientemente llamado primero
        if (aCalled && bCalled) {
          const aTime = a.calledAt ? new Date(a.calledAt).getTime() : 0;
          const bTime = b.calledAt ? new Date(b.calledAt).getTime() : 0;
          if (aTime !== bTime) return bTime - aTime;
        }

        // 3. Pacientes en WAITING por orden de llegada histórica
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      })
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
          status: entry.status,
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

    // Cuando un paciente es llamado (CALLED) -> actualizar y resaltar visualmente en TV por unos segundos
    const offCalled = this.socketService.on<QueueEntry>(
      QUEUE_EVENTS.PATIENT_CALLED,
      (updated) => {
        this.allEntries.update(list =>
          list.map(e => (e._id === updated._id ? { ...e, ...updated } : e))
        );
        this.triggerCallHighlight(updated._id);
      }
    );

    // Cuando un paciente inicia atención (IN_ATTENTION) -> actualizar estado (se oculta automáticamente de la TV)
    const offStarted = this.socketService.on<QueueEntry>(
      QUEUE_EVENTS.PATIENT_STARTED,
      (updated) => {
        this.allEntries.update(list =>
          list.map(e => (e._id === updated._id ? { ...e, ...updated } : e))
        );
        this.clearCallHighlight(updated._id);
      }
    );

    // Cuando un paciente completa o cancela -> remover de inmediato
    const offRemove = (event: string) => {
      return this.socketService.on<QueueEntry>(event, (removed) => {
        this.allEntries.update(list => list.filter(e => e._id !== removed._id));
        this.clearCallHighlight(removed._id);
      });
    };

    const offCompleted = offRemove(QUEUE_EVENTS.PATIENT_COMPLETED);
    const offCancelled = offRemove(QUEUE_EVENTS.PATIENT_CANCELLED);

    this.socketCleanups = [offAdded, offCalled, offStarted, offCompleted, offCancelled];
  }

  /**
   * Resalta por 8 segundos al paciente llamado y reproduce un sonido de campana de sala de espera.
   */
  triggerCallHighlight(entryId: string): void {
    if (this.callTimeouts.has(entryId)) {
      clearTimeout(this.callTimeouts.get(entryId));
    }

    this.recentlyCalledIds.update(set => {
      const next = new Set(set);
      next.add(entryId);
      return next;
    });

    this.playCallChime();

    // Desplazar suavemente al tope para que el paciente llamado sea visible de inmediato
    setTimeout(() => {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const container = document.querySelector('.table-container');
        if (container) {
          container.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch {
        // En caso de SSR o restricciones del navegador
      }
    }, 50);

    const timer = setTimeout(() => {
      this.clearCallHighlight(entryId);
    }, 8000);

    this.callTimeouts.set(entryId, timer);
  }

  clearCallHighlight(entryId: string): void {
    if (this.callTimeouts.has(entryId)) {
      clearTimeout(this.callTimeouts.get(entryId));
      this.callTimeouts.delete(entryId);
    }
    this.recentlyCalledIds.update(set => {
      if (!set.has(entryId)) return set;
      const next = new Set(set);
      next.delete(entryId);
      return next;
    });
  }

  isRecentlyCalled(id: string): boolean {
    return this.recentlyCalledIds().has(id);
  }

  /** Chime acústico armonioso de dos tonos (Ding-Dong) para sala de espera */
  private playCallChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      };

      const now = ctx.currentTime;
      playTone(659.25, now, 0.7);        // Nota E5 (Ding)
      playTone(523.25, now + 0.35, 1.1);  // Nota C5 (Dong)
    } catch {
      // Si el navegador bloquea audio por políticas de interacción, continúa silenciosamente
    }
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
    this.callTimeouts.forEach(t => clearTimeout(t));
    this.callTimeouts.clear();
    this.socketCleanups.forEach(cleanup => cleanup());
    this.socketService.leaveTvRoom();
  }
}
