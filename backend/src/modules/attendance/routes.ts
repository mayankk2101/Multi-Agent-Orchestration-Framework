import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/permissions.js';
import { checkIn, listAttendance, getAttendanceById, updateAttendance } from './controller.js';

const router = Router();

router.use(authMiddleware);

// RBAC per API_SPEC_V1_PATCH_V2 §PATCH-07:
// Check-in: workers only. Read: all authenticated (service scopes non-management to own).
// Update (check-out / verify): all authenticated (service guards field-level access).
router.post('/', requireRole(['worker']), checkIn);
router.get('/', listAttendance);
router.get('/:id', getAttendanceById);
router.patch('/:id', updateAttendance);

export default router;
