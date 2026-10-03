export function notFound(req, res) {
  res.status(404).json({ message: 'Endpoint not found.' });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error.'
  });
}
