import { Professional, UserRole } from '../professionals/professional.model';
import { signToken } from '../../middlewares/auth.middleware';
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
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const emailRaw = str(dto.email);
    const password = str(dto.password);
    const office = str(dto.office);

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

    logger.info(`[AuthService] Inicio de sesión exitoso: ${user._id} en ${office}`);

    const role = user.role ?? UserRole.PROFESSIONAL;

    return {
      user: {
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || '',
        office: user.office,
        active: user.active,
        role,
      },
      token: signToken({ id: user._id.toString(), role }),
    };
  }
}

export const authService = new AuthService();
