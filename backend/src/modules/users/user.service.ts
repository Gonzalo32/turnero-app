import { Types } from 'mongoose';
import { User, IUser, Role, ROLES } from './user.model';
import { Sede } from '../sedes/sede.model';
import { Professional } from '../professionals/professional.model';
import { professionalService } from '../professionals/professional.service';
import { keycloakAdmin } from '../../integrations/keycloak/keycloak-admin.service';
import { disconnectUserSockets } from '../queue/queue.socket';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';

export interface CreateUserDto {
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: Role;
  sedeId?: string;
  professionalId?: string;
  /** Si es odontólogo sin professionalId: crear el Professional con sus nombres. */
  createProfessional?: boolean;
  password: string;
}

export type UpdateUserDto = Partial<Omit<CreateUserDto, 'username' | 'password'>>;

const POPULATE = [
  { path: 'sedeId', select: 'name offices' },
  { path: 'professionalId', select: 'firstName lastName specialty colorTag' },
];

function assertPassword(password: string | undefined): asserts password is string {
  if (!password || password.length < 8) {
    throw createError('La contraseña debe tener al menos 8 caracteres', 400, 'VALIDATION_ERROR');
  }
}

async function validateRefs(role: Role, sedeId?: string, professionalId?: string, selfId?: string, createProfessional = false): Promise<void> {
  if (!ROLES.includes(role)) throw createError(`Rol inválido: ${role}`, 400, 'VALIDATION_ERROR');
  if (role === 'odontologo' && !professionalId && !createProfessional) {
    throw createError('Un odontólogo debe tener un profesional vinculado', 400, 'VALIDATION_ERROR');
  }
  if (role !== 'admin') {
    if (!sedeId || !Types.ObjectId.isValid(sedeId) || !(await Sede.exists({ _id: sedeId, active: true }))) {
      throw createError('Sede inválida', 400, 'VALIDATION_ERROR');
    }
  }
  if (professionalId) {
    if (!Types.ObjectId.isValid(professionalId) || !(await Professional.exists({ _id: professionalId }))) {
      throw createError('Profesional inválido', 400, 'VALIDATION_ERROR');
    }
    const taken = await User.exists({ professionalId, _id: { $ne: selfId } });
    if (taken) throw createError('Ese profesional ya tiene un usuario', 409, 'PROFESSIONAL_ALREADY_LINKED');
  }
}

export class UserService {
  list() {
    return User.find().populate(POPULATE).sort({ lastName: 1 }).lean();
  }

  async getById(id: string) {
    const user = Types.ObjectId.isValid(id) ? await User.findById(id).populate(POPULATE).lean() : null;
    if (!user) throw createError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    return user;
  }

  async create(dto: CreateUserDto) {
    if (!dto.username || !dto.firstName || !dto.lastName) {
      throw createError('Usuario, nombre y apellido son obligatorios', 400, 'VALIDATION_ERROR');
    }
    assertPassword(dto.password);
    await validateRefs(dto.role, dto.sedeId, dto.professionalId, undefined, dto.createProfessional);

    const kcInput = { username: dto.username.trim().toLowerCase(), email: dto.email?.trim() || undefined, firstName: dto.firstName.trim(), lastName: dto.lastName.trim() };
    const keycloakId = await keycloakAdmin.createUser(kcInput, dto.password);

    try {
      await keycloakAdmin.setRealmRole(keycloakId, dto.role);

      let professionalId = dto.professionalId;
      if (dto.role === 'odontologo' && !professionalId && dto.createProfessional) {
        const prof = await professionalService.createProfessional({ firstName: kcInput.firstName, lastName: kcInput.lastName, email: kcInput.email });
        professionalId = prof._id.toString();
      }

      const user = await User.create({ ...kcInput, keycloakId, role: dto.role, sedeId: dto.sedeId || undefined, professionalId });
      logger.info(`[UserService] Usuario creado: ${user.username} (${user.role})`);
      return this.getById(user._id.toString());
    } catch (err) {
      // Acción compensatoria: no dejar un usuario huérfano en Keycloak.
      await keycloakAdmin.deleteUser(keycloakId).catch((e) => logger.error('[UserService] Rollback Keycloak falló', e));
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = Types.ObjectId.isValid(id) ? await User.findById(id) : null;
    if (!user) throw createError('Usuario no encontrado', 404, 'USER_NOT_FOUND');

    const role = dto.role ?? user.role;
    const sedeId = dto.sedeId !== undefined ? dto.sedeId : user.sedeId?.toString();
    const professionalId = dto.professionalId !== undefined ? dto.professionalId : user.professionalId?.toString();
    await validateRefs(role, sedeId, professionalId, id);

    if (dto.firstName) user.firstName = dto.firstName.trim();
    if (dto.lastName) user.lastName = dto.lastName.trim();
    if (dto.email !== undefined) user.email = dto.email.trim() || undefined;

    await keycloakAdmin.updateUser(user.keycloakId, { firstName: user.firstName, lastName: user.lastName, email: user.email ?? '' });
    if (role !== user.role) await keycloakAdmin.setRealmRole(user.keycloakId, role);

    user.role = role;
    user.sedeId = sedeId ? new Types.ObjectId(sedeId) : undefined;
    user.professionalId = professionalId ? new Types.ObjectId(professionalId) : undefined;
    await user.save();
    logger.info(`[UserService] Usuario actualizado: ${user.username}`);
    return this.getById(id);
  }

  async setActive(id: string, active: boolean, actorId: string) {
    if (id === actorId && !active) throw createError('No podés desactivar tu propio usuario', 400, 'VALIDATION_ERROR');
    const user = Types.ObjectId.isValid(id) ? await User.findById(id) : null;
    if (!user) throw createError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    await keycloakAdmin.setEnabled(user.keycloakId, active);
    user.active = active;
    await user.save();
    if (!active) disconnectUserSockets(id);
    logger.info(`[UserService] Usuario ${active ? 'activado' : 'desactivado'}: ${user.username}`);
    return this.getById(id);
  }

  async resetPassword(id: string, password: string): Promise<void> {
    assertPassword(password);
    const user: IUser | null = Types.ObjectId.isValid(id) ? await User.findById(id) : null;
    if (!user) throw createError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    await keycloakAdmin.resetPassword(user.keycloakId, password);
    logger.info(`[UserService] Contraseña temporal reseteada: ${user.username}`);
  }
}

export const userService = new UserService();
