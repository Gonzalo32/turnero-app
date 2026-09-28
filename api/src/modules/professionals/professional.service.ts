import { Professional, IProfessional } from './professional.model';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';

export class ProfessionalService {

  /** Obtiene todos los profesionales activos, ordenados por apellido */
  async getActiveProfessionals(): Promise<IProfessional[]> {
    return Professional.find({ active: true }).sort({ lastName: 1 }).lean<IProfessional[]>();
  }

  /** Obtiene un profesional por ID */
  async getProfessionalById(id: string): Promise<IProfessional> {
    const prof = await Professional.findById(id).lean<IProfessional>();
    if (!prof) throw createError('Profesional no encontrado', 404, 'PROFESSIONAL_NOT_FOUND');
    return prof;
  }

  /** Desactiva lógicamente un profesional (AGENTS.md §53) */
  async deactivateProfessional(id: string): Promise<IProfessional> {
    const prof = await Professional.findByIdAndUpdate(
      id,
      { active: false },
      { new: true }
    ).lean<IProfessional>();

    if (!prof) throw createError('Profesional no encontrado', 404, 'PROFESSIONAL_NOT_FOUND');
    logger.info(`[ProfessionalService] Profesional desactivado: ${id}`);
    return prof;
  }
}

export const professionalService = new ProfessionalService();
