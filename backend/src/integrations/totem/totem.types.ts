/**
 * Registro que el tótem (odonto-app) envía al terminar el formulario.
 * Solo los datos necesarios para la cola (AGENTS.md §12).
 */
export interface TotemPatientRecord {
  /** _id del paciente en la base del tótem (estable por DNI) */
  _id: string;
  dni: string;
  nombre: string;
  apellido: string;
  obraSocial?: string;
  /** Nombre completo del profesional elegido en el tótem */
  profesional?: string;
  createdAt?: string;
}
