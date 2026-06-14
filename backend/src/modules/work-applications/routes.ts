import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/permissions.js';
import { applyToWorkRequest, listApplications, updateApplication } from './controller.js';

// mergeParams: true inherits :id (work_request_id) from the parent /work-requests/:id router
const router = Router({ mergeParams: true });

router.use(authMiddleware);

// RBAC per API_SPEC_V1_PATCH_V2 §PATCH-07:
// Apply: worker only. List: admin/manager (workers see only their own via service scoping).
// Update (approve/reject/withdraw): admin/manager may approve or reject; workers may withdraw.
router.post('/', requireRole(['worker']), applyToWorkRequest);
router.get('/', listApplications);
router.patch('/:applicationId', updateApplication);

export default router;
