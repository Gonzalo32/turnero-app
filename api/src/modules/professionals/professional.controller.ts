import { Request, Response, NextFunction } from 'express';
import { professionalService } from './professional.service';

/** GET /api/v1/professionals */
export async function getProfessionals(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const professionals = await professionalService.getActiveProfessionals();
    res.json({ success: true, data: professionals, message: null });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/professionals/:id */
export async function getProfessionalById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const professional = await professionalService.getProfessionalById(req.params['id']);
    res.json({ success: true, data: professional, message: null });
  } catch (err) {
    next(err);
  }
}
