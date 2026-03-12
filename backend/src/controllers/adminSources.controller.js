import {
  createAdminSource,
  getAdminSourceById,
  listAdminSources,
  updateAdminSource,
  validateCandidateSource
} from '../services/adminSourceService.js';

const parseOptionalPositiveInt = (raw, defaultValue, maximum = 1000) => {
  const value = Number(raw ?? defaultValue);

  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    const error = new Error('limit must be a positive integer');
    error.code = 'INVALID_LIMIT';
    error.statusCode = 400;
    throw error;
  }

  return value;
};

export const createAdminSourcesHandlers = (deps = {}) => {
  const resolved = {
    createAdminSource: deps.createAdminSource ?? createAdminSource,
    getAdminSourceById: deps.getAdminSourceById ?? getAdminSourceById,
    listAdminSources: deps.listAdminSources ?? listAdminSources,
    updateAdminSource: deps.updateAdminSource ?? updateAdminSource,
    validateCandidateSource: deps.validateCandidateSource ?? validateCandidateSource
  };

  return {
    listSources: async (req, res, next) => {
      try {
        const limit = parseOptionalPositiveInt(req.query.limit, 100, 500);
        const sources = await resolved.listAdminSources({
          limit,
          status: req.query.status,
          type: req.query.type
        });

        res.json({
          data: sources,
          meta: { requestId: req.requestId, count: sources.length },
          error: null
        });
      } catch (error) {
        next(error);
      }
    },
    getSourceById: async (req, res, next) => {
      try {
        const source = await resolved.getAdminSourceById({ id: req.params.sourceId });

        res.json({
          data: source,
          meta: { requestId: req.requestId },
          error: null
        });
      } catch (error) {
        next(error);
      }
    },
    validateSource: async (req, res, next) => {
      try {
        const validation = await resolved.validateCandidateSource(req.body ?? {});

        res.json({
          data: validation,
          meta: { requestId: req.requestId },
          error: null
        });
      } catch (error) {
        next(error);
      }
    },
    createSource: async (req, res, next) => {
      try {
        const source = await resolved.createAdminSource(req.body ?? {});

        res.status(201).json({
          data: source,
          meta: { requestId: req.requestId },
          error: null
        });
      } catch (error) {
        next(error);
      }
    },
    updateSource: async (req, res, next) => {
      try {
        const source = await resolved.updateAdminSource({
          id: req.params.sourceId,
          input: req.body ?? {}
        });

        res.json({
          data: source,
          meta: { requestId: req.requestId },
          error: null
        });
      } catch (error) {
        next(error);
      }
    }
  };
};

export const { listSources, getSourceById, validateSource, createSource, updateSource } = createAdminSourcesHandlers();
