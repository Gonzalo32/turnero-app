import { Types } from 'mongoose';
import { Sede } from './sede.model';
import { createError } from '../../middlewares/error.middleware';

export interface SedeDto {
  name?: string;
  address?: string;
  offices?: string[];
  active?: boolean;
}

function cleanOffices(offices?: string[]): string[] | undefined {
  return offices?.map((o) => String(o).trim()).filter(Boolean);
}

export const sedeService = {
  list(includeInactive: boolean) {
    return Sede.find(includeInactive ? {} : { active: true }).sort({ name: 1 }).lean();
  },

  async create(dto: SedeDto) {
    if (!dto.name?.trim()) throw createError('El nombre es obligatorio', 400, 'VALIDATION_ERROR');
    if (await Sede.exists({ name: dto.name.trim() })) throw createError('Ya existe una sede con ese nombre', 409, 'SEDE_ALREADY_EXISTS');
    return (await Sede.create({ name: dto.name.trim(), address: dto.address?.trim(), offices: cleanOffices(dto.offices) ?? [] })).toObject();
  },

  async update(id: string, dto: SedeDto) {
    const sede = Types.ObjectId.isValid(id) ? await Sede.findById(id) : null;
    if (!sede) throw createError('Sede no encontrada', 404, 'SEDE_NOT_FOUND');
    if (dto.name?.trim()) sede.name = dto.name.trim();
    if (dto.address !== undefined) sede.address = dto.address.trim();
    if (dto.offices) sede.offices = cleanOffices(dto.offices)!;
    if (dto.active !== undefined) sede.active = dto.active;
    await sede.save();
    return sede.toObject();
  },
};
