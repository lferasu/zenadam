import { Router } from 'express';
import {
  createSource,
  getSourceById,
  listSources,
  updateSource,
  validateSource
} from '../../controllers/adminSources.controller.js';

const adminSourcesRouter = Router();

adminSourcesRouter.get('/admin/sources', listSources);
adminSourcesRouter.get('/admin/sources/:sourceId', getSourceById);
adminSourcesRouter.post('/admin/sources/validate', validateSource);
adminSourcesRouter.post('/admin/sources', createSource);
adminSourcesRouter.patch('/admin/sources/:sourceId', updateSource);

export default adminSourcesRouter;
