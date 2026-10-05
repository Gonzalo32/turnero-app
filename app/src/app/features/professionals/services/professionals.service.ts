import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Professional, CreateProfessionalDto } from '../models/professional.model';
import { logger } from '../../../core/utils/logger';

/**
 * Servicio para gestión de Odontólogos / Profesionales.
 * Cumple con AGENTS.md §40 (separación de HTTP y componentes) y §42 (versionado de API).
 */
@Injectable({ providedIn: 'root' })
export class ProfessionalsService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/professionals`;

  /** Lista de profesionales cargados en memoria reactiva */
  readonly professionals = signal<Professional[]>([]);

  /** Estado de carga */
  readonly loading = signal<boolean>(false);

  /** Mensaje de error si la carga falla */
  readonly error = signal<string | null>(null);

  /**
   * Carga todos los profesionales activos desde el backend.
   */
  async loadProfessionals(): Promise<Professional[]> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<Professional[]>>(this.apiUrl)
      );

      if (res.success && res.data) {
        this.professionals.set(res.data);
        return res.data;
      }
      return [];
    } catch (err: any) {
      const msg = err?.error?.message || 'Error al obtener la lista de odontólogos';
      this.error.set(msg);
      logger.error(`[ProfessionalsService] Error al cargar profesionales: ${msg}`, err);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Crea un nuevo odontólogo y actualiza la lista.
   */
  async createProfessional(dto: CreateProfessionalDto): Promise<Professional> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<Professional>>(this.apiUrl, dto)
      );

      if (res.success && res.data) {
        // Refrescar la lista de profesionales
        await this.loadProfessionals();
        return res.data;
      }
      throw new Error(res.message || 'Error desconocido al crear odontólogo');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error al crear odontólogo';
      logger.error(`[ProfessionalsService] Error en createProfessional: ${msg}`, err);
      throw new Error(msg);
    }
  }

  /**
   * Actualiza datos de un odontólogo.
   */
  async updateProfessional(id: string, dto: Partial<CreateProfessionalDto>): Promise<Professional> {
    try {
      const res = await firstValueFrom(
        this.http.put<ApiResponse<Professional>>(`${this.apiUrl}/${id}`, dto)
      );

      if (res.success && res.data) {
        await this.loadProfessionals();
        return res.data;
      }
      throw new Error(res.message || 'Error desconocido al actualizar odontólogo');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error al actualizar odontólogo';
      logger.error(`[ProfessionalsService] Error en updateProfessional: ${msg}`, err);
      throw new Error(msg);
    }
  }

  /**
   * Obtiene un profesional específico por su ID.
   */
  async getProfessionalById(id: string): Promise<Professional | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<Professional>>(`${this.apiUrl}/${id}`)
      );
      return res.success && res.data ? res.data : null;
    } catch (err) {
      logger.error(`[ProfessionalsService] Error al cargar profesional ${id}`, err);
      return null;
    }
  }
}
