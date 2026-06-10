import { Router } from 'express';
import { userController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole, requirePermission } from '../../middleware/permissions.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('users:read'), ...userController.listUsers);
router.post('/', requireRole(['admin', 'manager']), requirePermission('users:write'), ...userController.createUser);
router.get('/:user_id', requirePermission('users:read'), (req, res, next) => userController.getUser(req, res, next));
router.put('/:user_id', requireRole(['admin', 'manager']), requirePermission('users:write'), ...userController.updateUser);
router.delete('/:user_id', requireRole('admin'), (req, res, next) => userController.deleteUser(req, res, next));

export default router;
