/**
 * Registro que el tótem (odonto-app) envía al terminar el formulario.
 * Incluye datos filiatorios del paciente y el profesional seleccionado.
 */
export interface TotemPatientRecord {
  /** _id del paciente en la base del tótem (estable por DNI) */
  _id: string;
  dni: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  fechaNacimiento?: string;
  obraSocial?: string;
  numeroAfiliado?: string;
  /** Nombre completo del profesional elegido en el tótem */
  profesional?: string;
  localidad?: string;
  domicilio?: string;
  observacion?: any[];
  createdAt?: string;
}

