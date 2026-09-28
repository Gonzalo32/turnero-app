/**
 * Tipos del sistema del tótem (sistema externo/legado).
 * AGENTS.md §35: La integración con el tótem está aislada en este módulo.
 *
 * Estos tipos representan la estructura de datos del tótem tal como es,
 * sin contaminar los módulos internos del nuevo sistema.
 */
export interface TotemPatientRecord {
  _id: string;
  dni: string;
  nombre: string;
  apellido: string;
  obraSocial?: string;
  profesional?: string;
  telefono?: string;
  createdAt?: string;
}

/** Mapeo de nombre de profesional del tótem a ID interno del sistema */
export interface ProfessionalMapping {
  totemName: string;
  systemProfessionalId: string;
}
