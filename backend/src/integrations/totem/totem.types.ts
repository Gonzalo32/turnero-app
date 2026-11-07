import type { PacienteDetalle } from '../../modules/patients/patient.model';

/**
 * Registro que el tótem (odonto-app) envía al terminar el formulario.
 * Los datos filiatorios opcionales se guardan en 'pacientes'.
 */
export interface TotemPatientRecord extends PacienteDetalle {
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

/**
 * Representación simplificada de un profesional para sincronizar con la base de datos del tótem.
 * Solo contiene _id, nombre, apellido, matrícula y estado activo.
 */
export interface TotemProfessionalSync {
  _id: string;
  nombre: string;
  apellido: string;
  matricula: string;
  activo: boolean;
}
