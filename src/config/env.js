'use strict';

require('dotenv').config();

/**
 * Centralised, validated environment configuration.
 * Fail fast at boot if a required secret is missing.
 */
const required = ['MONGO_URI', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn(
    `[config] Missing env vars: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill them in.'
  );
}

const num = (val, fallback) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: num(process.env.PORT, 5000),

  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/drivenow',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  business: {
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
    taxRate: num(process.env.TAX_RATE, 0.08),
    insuranceFeePerDay: num(process.env.INSURANCE_FEE_PER_DAY, 12),
    lateReturnFeePerHour: num(process.env.LATE_RETURN_FEE_PER_HOUR, 15),
    fuelPenaltyPerPercent: num(process.env.FUEL_PENALTY_PER_PERCENT, 2.5),
  },

  pricing: {
    surgeMaxMultiplier: num(process.env.SURGE_MAX_MULTIPLIER, 2.5),
    leadTimeDiscountMax: num(process.env.LEAD_TIME_DISCOUNT_MAX, 0.15),
  },

  loyalty: {
    pointsPerCurrencyUnit: num(process.env.POINTS_PER_CURRENCY_UNIT, 1),
  },
};
