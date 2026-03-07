export const notFoundHandler = (req, res) => {
  res.status(404).json({
    data: null,
    meta: { requestId: req.requestId },
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
};

export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode ?? 500;
  res.status(statusCode).json({
    data: null,
    meta: { requestId: req.requestId },
    error: {
      code: error.code ?? 'INTERNAL_SERVER_ERROR',
      message: error.message ?? 'Unexpected error'
    }
  });
  next();
};
