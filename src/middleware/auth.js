'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Require a valid access token. Attaches the full user doc to req.user.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Authentication token required');

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('User not found or inactive');

  req.user = user;
  next();
});

/**
 * Restrict a route to specific roles. Use after authenticate().
 *   router.post('/', authenticate, authorize('admin', 'staff'), handler)
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Insufficient permissions'));
  }
  next();
};

module.exports = { authenticate, authorize };
