import { Professional } from '../professionals/professional.model';
import { LoginDto, LoginResponseData } from './auth.types';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';

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

    // Persistir consultorio seleccionado en esta sesión
    user.office = office;
    await user.save();

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
}

export const authService = new AuthService();
