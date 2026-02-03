import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { 
  createUserHandler, 
  deleteUserHandler, 
  listUsersHandler, 
  updateUserHandler,
  changeUserPasswordHandler,
  toggleUserStatusHandler,
  updateUserRoleHandler
} from '../controllers/user.controller';

const router = Router();

router.use(authenticate(['SUPER_ADMIN', 'ADMIN']));

router.get('/', listUsersHandler);
router.post('/', createUserHandler);
router.patch('/:id', updateUserHandler);
router.delete('/:id', deleteUserHandler);

// New user management endpoints
router.patch('/:id/password', changeUserPasswordHandler);
router.patch('/:id/status', toggleUserStatusHandler);
router.patch('/:id/role', updateUserRoleHandler);

export const userRoutes = router;
