import { Professional, IProfessional } from './professional.model';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';
import bcrypt from 'bcryptjs';

export interface CreateProfessionalDto {
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  dni?: string;
  birthDate?: string | Date;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  specialty?: string;
  colorTag?: string;
  notes?: string;
}

export interface UpdateProfessionalDto extends Partial<CreateProfessionalDto> {
  active?: boolean;
}

export class ProfessionalService {

  /** Obtiene todos los profesionales activos, ordenados por apellido, sin exponer contraseña */
  async getActiveProfessionals(): Promise<IProfessional[]> {
    return Professional.find({ active: true })
      .select('-password')
      .sort({ lastName: 1 })
      .lean<IProfessional[]>();
  }

  /** Obtiene un profesional por ID (sin contraseña) */
  async getProfessionalById(id: string): Promise<IProfessional> {
    const prof = await Professional.findById(id).select('-password').lean<IProfessional>();
    if (!prof) throw createError('Profesional no encontrado', 404, 'PROFESSIONAL_NOT_FOUND');
    return prof;
  }

  /** Crea un nuevo odontólogo validando unicidad de correo y DNI */
  async createProfessional(data: CreateProfessionalDto): Promise<IProfessional> {
    if (!data.firstName || !data.lastName) {
      throw createError('Nombre y apellido son obligatorios', 400, 'VALIDATION_ERROR');
    }

    // Verificar si el correo ya está registrado
    if (data.email) {
      const emailNormalized = data.email.trim().toLowerCase();
      const existingEmail = await Professional.findOne({ email: emailNormalized });
      if (existingEmail) {
        throw createError(`El correo ${emailNormalized} ya se encuentra registrado`, 409, 'EMAIL_ALREADY_EXISTS');
      }
    }

    // Verificar si el DNI ya está registrado
    if (data.dni) {
      const dniClean = data.dni.trim();
      const existingDni = await Professional.findOne({ dni: dniClean });
      if (existingDni) {
        throw createError(`El DNI ${dniClean} ya está registrado para otro profesional`, 409, 'DNI_ALREADY_EXISTS');
      }
    }

    const newProfessional = new Professional({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      licenseNumber: data.licenseNumber?.trim(),
      dni: data.dni?.trim(),
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      email: data.email?.trim().toLowerCase(),
      password: data.password, // el pre-save hook lo encripta
      phone: data.phone?.trim(),
      address: data.address?.trim(),
      specialty: data.specialty?.trim() || 'Odontología General',
      colorTag: data.colorTag?.trim() || '#866385',
      notes: data.notes?.trim(),
      active: true,
    });

    await newProfessional.save();
    logger.info(`[ProfessionalService] Odontólogo creado: ${newProfessional.lastName}, ${newProfessional.firstName} (${newProfessional._id})`);

    // Devolver objeto sin la propiedad password
    const result = newProfessional.toObject() as IProfessional;
    delete (result as any).password;
    return result;
  }

  /** Actualiza datos de un odontólogo */
  async updateProfessional(id: string, data: UpdateProfessionalDto): Promise<IProfessional> {
    const prof = await Professional.findById(id);
    if (!prof) throw createError('Profesional no encontrado', 404, 'PROFESSIONAL_NOT_FOUND');

    if (data.firstName) prof.firstName = data.firstName.trim();
    if (data.lastName) prof.lastName = data.lastName.trim();
    if (data.licenseNumber !== undefined) prof.licenseNumber = data.licenseNumber?.trim();
    if (data.dni !== undefined) prof.dni = data.dni?.trim();
    if (data.birthDate !== undefined) prof.birthDate = data.birthDate ? new Date(data.birthDate) : undefined;
    if (data.phone !== undefined) prof.phone = data.phone?.trim();
    if (data.address !== undefined) prof.address = data.address?.trim();
    if (data.specialty !== undefined) prof.specialty = data.specialty?.trim();
    if (data.colorTag !== undefined) prof.colorTag = data.colorTag?.trim();
    if (data.notes !== undefined) prof.notes = data.notes?.trim();
    if (data.active !== undefined) prof.active = data.active;

    if (data.email) {
      const emailNormalized = data.email.trim().toLowerCase();
      if (emailNormalized !== prof.email) {
        const existing = await Professional.findOne({ email: emailNormalized, _id: { $ne: id } });
        if (existing) {
          throw createError(`El correo ${emailNormalized} ya pertenece a otro profesional`, 409, 'EMAIL_ALREADY_EXISTS');
        }
        prof.email = emailNormalized;
      }
    }

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      prof.password = await bcrypt.hash(data.password, salt);
    }

    await prof.save();
    logger.info(`[ProfessionalService] Odontólogo actualizado: ${prof._id}`);

    const result = prof.toObject() as IProfessional;
    delete (result as any).password;
    return result;
  }

  /** Desactiva lógicamente un profesional (AGENTS.md §53) */
  async deactivateProfessional(id: string): Promise<IProfessional> {
    const prof = await Professional.findByIdAndUpdate(
      id,
      { active: false },
      { new: true }
    ).select('-password').lean<IProfessional>();

    if (!prof) throw createError('Profesional no encontrado', 404, 'PROFESSIONAL_NOT_FOUND');
    logger.info(`[ProfessionalService] Profesional desactivado: ${id}`);
    return prof;
  }
}

export const professionalService = new ProfessionalService();
