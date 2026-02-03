import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createDomainHandler, deleteDomainHandler, listDomainsHandler, updateDomainHandler } from '../controllers/domain.controller';

const router = Router();

router.use(authenticate(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']));

router.get('/', listDomainsHandler);
router.post('/', createDomainHandler);
router.patch('/:id', updateDomainHandler);
router.delete('/:id', deleteDomainHandler);

export const domainRoutes = router;
