import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { listAssignments, getAssignment, updateAssignment } from './controller.js';

const router = Router();

router.use(authMiddleware);

// RBAC per API_SPEC_V1_PATCH_V2 §PATCH-07:
// Read: all authenticated roles (service scopes workers to their own assignments).
// Update (start/complete/cancel): all authenticated roles with service-level guards.
router.get('/', listAssignments);
router.get('/:id', getAssignment);
router.patch('/:id', updateAssignment);

export default router;
