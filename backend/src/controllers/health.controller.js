export const getHealth = (req, res) => {
  res.json({
    data: {
      status: 'ok',
      service: 'zenadam-api',
      timestamp: new Date().toISOString()
    },
    meta: {
      requestId: req.requestId
    },
    error: null
  });
};
