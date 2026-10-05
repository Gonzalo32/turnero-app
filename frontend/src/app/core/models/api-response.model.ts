/**
 * Formato uniforme de respuestas de la API (AGENTS.md §43).
 * Todo endpoint devuelve este formato.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  code?: string;
}
