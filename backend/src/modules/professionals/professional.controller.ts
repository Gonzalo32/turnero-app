import { Request, Response, NextFunction } from 'express';
import { professionalService } from './professional.service';
import { canAccessProfessional } from '../../middlewares/auth.middleware';
import { createError } from '../../middlewares/error.middleware';

/** GET /api/v1/professionals */
export async function getProfessionals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Secretarias solo ven los profesionales de su sede; admin puede filtrar por ?sedeId=
    const user = req.user!;
    const sedeId = user.roles.includes('admin') ? (req.query['sedeId'] as string | undefined) : user.sedeId;
    const professionals = await professionalService.getActiveProfessionals(sedeId);
    res.json({ success: true, data: professionals, message: null });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/professionals/:id */
export async function getProfessionalById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Ficha completa (DNI, teléfono, domicilio): solo a quien tiene acceso a ese profesional
    if (!(await canAccessProfessional(req.user!, req.params['id']))) {
      throw createError('No tenés acceso a este profesional', 403, 'FORBIDDEN');
    }
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
