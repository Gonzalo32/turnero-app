import { Professional, UserRole } from '../professionals/professional.model';
import { Atencion } from '../atenciones/atencion.model';
import { QueueStatus } from '../queue/queue.types';
import { signToken } from '../../middlewares/auth.middleware';
import { LoginDto, LoginResponseData } from './auth.types';
import { createError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';
import { emitSessionDisplaced, emitOfficeAssigned } from '../queue/queue.socket';

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
      for (const displacedId of displacedProfessionalIds) {
        emitOfficeAssigned({ professionalId: displacedId, office: '' });
      }
    }

    // Persistir consultorio seleccionado en esta sesión
    user.office = office;
    await user.save();

    // Actualizar consultorio en todas las atenciones activas (espera y llamado) del profesional
    await Atencion.updateMany(
      {
        professionalId: user._id.toString(),
        estado: { $in: [QueueStatus.WAITING, QueueStatus.CALLED] },
      },
      { $set: { consultorio: office } }
    );

    // Notificar al televisor y clientes en tiempo real el consultorio del profesional
    emitOfficeAssigned({
      professionalId: user._id.toString(),
      office,
    });

    if (displacedProfessionalIds.length > 0) {
      emitSessionDisplaced({
        office,
        newProfessionalId: user._id.toString(),
        displacedProfessionalIds,
        replacedByName: `${user.firstName} ${user.lastName}`.trim(),
      });
    }

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

  /**
   * Libera el consultorio asignado al profesional cuando cierra su sesión.
   */
  async logout(professionalId?: string): Promise<void> {
    const id = professionalId?.trim();
    if (!id) return;

    await Professional.findByIdAndUpdate(id, { $set: { office: '' } });
    emitOfficeAssigned({ professionalId: id, office: '' });
    logger.info(`[AuthService] Cierre de sesión: consultorio liberado para profesional ${id}`);
  }
}

export const authService = new AuthService();
