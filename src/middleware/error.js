'use strict';

const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/env');

/** 404 handler for unmatched routes. */
function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Central error handler — the only place that formats error responses. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // Normalise common Mongoose/Mongo errors into ApiError.
  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Validation failed', details);
  } else if (error.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
  } else if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`Duplicate value for ${field}`);
  } else if (!(error instanceof ApiError)) {
    logger.error('Unhandled error:', error.stack || error.message);
    error = new ApiError(500, config.isProd ? 'Internal server error' : error.message);
  }

  const body = {
    success: false,
    message: error.message,
  };
  if (error.details) body.details = error.details;
  if (!config.isProd && error.statusCode >= 500) body.stack = err.stack;

  res.status(error.statusCode || 500).json(body);
}

module.exports = { notFound, errorHandler };
