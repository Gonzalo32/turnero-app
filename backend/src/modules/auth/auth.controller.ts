import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, office, force } = req.body;
      const data = await authService.login({
        email,
        password,
        office,
        force: Boolean(force),
      });

      res.json({
        success: true,
        data,
        message: data.conflict
          ? 'El consultorio seleccionado se encuentra en uso'
          : 'Sesión iniciada correctamente',
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { professionalId } = req.body ?? {};
      await authService.logout(professionalId);

      res.json({
        success: true,
        data: null,
        message: 'Sesión cerrada correctamente',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
