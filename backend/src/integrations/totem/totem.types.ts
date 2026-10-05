/**
 * Tipos del sistema del tótem (odonto-app).
 * Refleja exactamente la estructura del modelo Patient.
 */
export interface TotemPatientRecord {
  _id: string;
  dni: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  fechaNacimiento?: string;
  obraSocial?: string;
  numeroAfiliado?: string;
  profesional?: string;
  localidad?: string;
  domicilio?: string;
  observacion?: any[];
  createdAt?: string;
}

/** Mapeo de nombre de profesional del tótem a ID interno del sistema */
export interface ProfessionalMapping {
  totemName: string;
  systemProfessionalId: string;
}
