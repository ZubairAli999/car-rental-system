'use strict';

/**
 * Wraps an async Express handler so rejected promises flow to next(err)
 * instead of crashing the process. Keeps controllers free of try/catch.
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
