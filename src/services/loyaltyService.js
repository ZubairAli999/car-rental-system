'use strict';

const config = require('../config/env');

/**
 * Loyalty programme rules. Tiers unlock a standing discount on every booking
 * and are recalculated from lifetime points whenever points are awarded.
 */
const TIERS = [
  { name: 'platinum', minLifetime: 10000, discountRate: 0.12, pointsMultiplier: 2 },
  { name: 'gold', minLifetime: 4000, discountRate: 0.08, pointsMultiplier: 1.5 },
  { name: 'silver', minLifetime: 1000, discountRate: 0.04, pointsMultiplier: 1.25 },
  { name: 'bronze', minLifetime: 0, discountRate: 0, pointsMultiplier: 1 },
];

function tierFor(lifetimePoints) {
  return TIERS.find((t) => lifetimePoints >= t.minLifetime) || TIERS[TIERS.length - 1];
}

function tierConfig(tierName) {
  return TIERS.find((t) => t.name === tierName) || TIERS[TIERS.length - 1];
}

/** Standing discount rate (0–1) a user gets from their current tier. */
function discountRateForUser(user) {
  return tierConfig(user?.loyalty?.tier).discountRate;
}

/** Points earned on a spend, boosted by the user's current tier multiplier. */
function pointsForSpend(amount, user) {
  const base = amount * config.loyalty.pointsPerCurrencyUnit;
  const mult = tierConfig(user?.loyalty?.tier).pointsMultiplier;
  return Math.round(base * mult);
}

/**
 * Mutates and returns the user doc: credits points, updates lifetime total,
 * and promotes the tier if a threshold was crossed. Caller persists.
 */
function awardPoints(user, points) {
  user.loyalty.points += points;
  user.loyalty.lifetimePoints += points;
  const newTier = tierFor(user.loyalty.lifetimePoints).name;
  const promoted = newTier !== user.loyalty.tier;
  user.loyalty.tier = newTier;
  return { user, promoted, tier: newTier };
}

/** Spend points (e.g. redeem for a discount). Returns false if insufficient. */
function redeemPoints(user, points) {
  if (user.loyalty.points < points) return false;
  user.loyalty.points -= points;
  return true;
}

module.exports = {
  TIERS,
  tierFor,
  tierConfig,
  discountRateForUser,
  pointsForSpend,
  awardPoints,
  redeemPoints,
};
