import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, office } = req.body;
      const data = await authService.login({ email, password, office });

      res.json({
        success: true,
        data,
        message: 'Sesión iniciada correctamente',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
