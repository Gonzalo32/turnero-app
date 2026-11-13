import { Professional } from '../professionals/professional.model';
import { LoginDto, LoginResponseData } from './auth.types';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';
import { emitSessionDisplaced } from '../queue/queue.socket';

export class AuthService {
  /**
   * Autentica a un usuario (profesional o admin) y asigna su consultorio activo.
   * Reglas:
   * - Correo, contraseña y consultorio son obligatorios (3 campos).
   * - Contraseña verificada mediante bcrypt en el modelo.
   * - El consultorio seleccionado se actualiza en el registro del usuario.
   */
  async login(dto: LoginDto): Promise<LoginResponseData> {
    const emailRaw = dto.email?.trim();
    const password = dto.password?.trim();
    const office = dto.office?.trim();

    if (!emailRaw || !password || !office) {
      throw createError(
        'El correo, la contraseña y el consultorio son obligatorios',
        400,
        'MISSING_FIELDS'
      );
    }

    const emailNormalized = emailRaw.toLowerCase();
    const isAdminIdentifier = ['admin', 'admin@admin.com', 'admin@senza.com', 'admin@gmail.com'].includes(emailNormalized);

    const user = await Professional.findOne({
      $or: isAdminIdentifier
        ? [{ email: 'admin' }, { email: emailNormalized }]
        : [{ email: emailNormalized }],
      active: true,
    }).select('+password');

    if (!user) {
      throw createError('Correo o contraseña incorrectos', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw createError('Correo o contraseña incorrectos', 401, 'INVALID_CREDENTIALS');
    }

    // Verificar si otro profesional activo ya está utilizando el consultorio seleccionado
    const occupants = await Professional.find({
      _id: { $ne: user._id },
      active: true,
      office,
    })
      .sort({ updatedAt: -1 })
      .select('_id firstName lastName office');

    if (occupants.length > 0 && !dto.force) {
      const occupant = occupants[0];
      logger.info(
        `[AuthService] Consultorio en uso (${office}) por ${occupant.firstName} ${occupant.lastName}; solicita acceso ${user.firstName} ${user.lastName}`
      );
      return {
        conflict: {
          office,
          occupiedBy: {
            _id: occupant._id.toString(),
            firstName: occupant.firstName,
            lastName: occupant.lastName,
          },
        },
      };
    }

    const displacedProfessionalIds = occupants.map((o) => o._id.toString());

    // Si se confirma continuar (force) o había otro profesional en ese consultorio, desloguearlo liberando su consultorio
    if (displacedProfessionalIds.length > 0) {
      await Professional.updateMany(
        { _id: { $ne: user._id }, office },
        { $set: { office: '' } }
      );
    }

    // Persistir consultorio seleccionado en esta sesión
    user.office = office;
    await user.save();

    // Emitir evento en tiempo real para cerrar la sesión activa del odontólogo anterior en ese consultorio
    emitSessionDisplaced({
      office,
      newProfessionalId: user._id.toString(),
      displacedProfessionalIds,
      replacedByName: `${user.firstName} ${user.lastName}`.trim(),
    });

    logger.info(
      `[AuthService] Inicio de sesión exitoso: ${user.firstName} ${user.lastName} (${user.email || 'sin-correo'}) en ${office}`
    );

    return {
      user: {
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || '',
        office: user.office,
        active: user.active,
      },
    };
  }

  /**
   * Libera el consultorio asignado al profesional cuando cierra su sesión.
   */
  async logout(professionalId?: string): Promise<void> {
    const id = professionalId?.trim();
    if (!id) return;

    await Professional.findByIdAndUpdate(id, { $set: { office: '' } });
    logger.info(`[AuthService] Cierre de sesión: consultorio liberado para profesional ${id}`);
  }
}

export const authService = new AuthService();
