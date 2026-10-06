import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { logger } from '../utils/logger';

/**
 * Servicio centralizado de Socket.IO.
 * AGENTS.md §41: La conexión Socket.IO debe estar centralizada, no en cada componente.
 * AGENTS.md §24: Soporta reconexión automática.
 *
 * Las features consumen eventos a través de sus propios servicios,
 * que inyectan SocketService y se suscriben a los eventos que necesitan.
 */
@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private professionalRoom: string | null = null;
  private keycloak = inject(KeycloakService);

  /** Estado de conexión reactivo */
  readonly connected = signal<boolean>(false);

  /** Conecta al servidor Socket.IO */
  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      // Se evalúa en cada (re)conexión: renueva el token si vence en <30s
      auth: (cb) => {
        this.keycloak.updateToken(30)
          .catch(() => this.keycloak.login())
          .then(() => this.keycloak.getToken())
          .then((token) => cb({ token }));
      },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      logger.debug('[SocketService] Conectado:', this.socket?.id);
      this.connected.set(true);
      // Reconectar a la sala del profesional si había una sesión activa
      if (this.professionalRoom) {
        this.joinProfessionalRoom(this.professionalRoom);
      }
    });

    this.socket.on('disconnect', (reason) => {
      logger.warn('[SocketService] Desconectado:', reason);
      this.connected.set(false);
      // El backend corta al vencer el token; reconectar pide uno nuevo vía `auth`
      if (reason === 'io server disconnect') this.socket?.connect();
    });

    this.socket.on('connect_error', (err) => {
      logger.error('[SocketService] Error de conexión:', err.message);
      this.connected.set(false);
    });
  }

  /** Desconecta limpiamente */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.professionalRoom = null;
      this.connected.set(false);
    }
  }

  /**
   * Une al cliente a la sala de un profesional específico.
   * El backend filtrará los eventos de cola para esta sala.
   */
  joinProfessionalRoom(professionalId: string): void {
    this.professionalRoom = professionalId;
    this.socket?.emit('queue:join-professional', professionalId);
    logger.debug('[SocketService] Unido a sala professional:', professionalId);
  }

  /** Sale de la sala del profesional actual */
  leaveProfessionalRoom(): void {
    if (this.professionalRoom) {
      this.socket?.emit('queue:leave-professional', this.professionalRoom);
      this.professionalRoom = null;
    }
  }

  /**
   * Suscribe a un evento Socket.IO.
   * Devuelve una función de cleanup para usar en ngOnDestroy.
   */
  on<T>(event: string, callback: (data: T) => void): () => void {
    this.socket?.on(event, callback);
    return () => this.socket?.off(event, callback);
  }

  /** Estado de conexión actual */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
