'use strict';

const rateLimit = require('express-rate-limit');

/** Generous global limiter to blunt abuse without hurting normal usage. */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down' },
});

/** Tight limiter for auth endpoints to resist credential stuffing. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, try again later' },
});

module.exports = { globalLimiter, authLimiter };
