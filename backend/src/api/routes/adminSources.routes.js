import { Router } from 'express';
import {
  createCandidateSource,
  createSource,
  getSourceById,
  listSources,
  updateCandidateSource,
  updateSource,
  validateSource
} from '../../controllers/adminSources.controller.js';

const adminSourcesRouter = Router();

adminSourcesRouter.get('/admin/sources', listSources);
adminSourcesRouter.get('/admin/sources/:sourceId', getSourceById);
adminSourcesRouter.post('/admin/sources/validate', validateSource);
adminSourcesRouter.post('/admin/sources', createSource);
adminSourcesRouter.post('/admin/candidate-sources', createCandidateSource);
adminSourcesRouter.patch('/admin/sources/:sourceId', updateSource);
adminSourcesRouter.put('/admin/candidate-sources/:sourceId', updateCandidateSource);
adminSourcesRouter.patch('/admin/candidate-sources/:sourceId', updateCandidateSource);

export default adminSourcesRouter;
