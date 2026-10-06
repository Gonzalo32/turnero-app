import { userService } from './user.service';
import { handle } from '../../utils/handle';

export const listUsers = handle(() => userService.list());
export const getMe = handle((req) => userService.getById(req.user!.id));
export const createUser = handle((req) => userService.create(req.body), 'Usuario creado', 201);
export const updateUser = handle((req) => userService.update(req.params['id'], req.body), 'Usuario actualizado');
export const setUserActive = handle(
  (req) => userService.setActive(req.params['id'], req.body.active === true, req.user!.id),
  'Estado actualizado'
);
export const resetUserPassword = handle(
  (req) => userService.resetPassword(req.params['id'], req.body.password),
  'Contraseña temporal asignada'
);
