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

/** POST /api/v1/professionals */
export async function createProfessional(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const newProf = await professionalService.createProfessional(req.body);
    res.status(201).json({
      success: true,
      data: newProf,
      message: 'Odontólogo creado exitosamente'
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/professionals/:id */
export async function updateProfessional(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await professionalService.updateProfessional(req.params['id'], req.body);
    res.json({
      success: true,
      data: updated,
      message: 'Odontólogo actualizado exitosamente'
    });
  } catch (err) {
    next(err);
  }
}
