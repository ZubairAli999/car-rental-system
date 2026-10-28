'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const loyaltyService = require('../services/loyaltyService');

/** Customer submits license details → status goes to "pending". */
const submitLicense = asyncHandler(async (req, res) => {
  const user = req.user;
  user.license.number = req.body.number;
  user.license.expiresAt = req.body.expiresAt;
  user.license.status = 'pending';
  user.license.verifiedAt = undefined;
  user.license.rejectionReason = undefined;
  await user.save();
  sendSuccess(res, { message: 'License submitted for verification', data: user.toSafeJSON() });
});

/** Staff/admin verifies or rejects a license. */
const verifyLicense = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.license.status !== 'pending') {
    throw ApiError.conflict('No pending license to review');
  }
  user.license.status = req.body.status;
  if (req.body.status === 'verified') {
    user.license.verifiedAt = new Date();
    user.license.rejectionReason = undefined;
  } else {
    user.license.rejectionReason = req.body.rejectionReason || 'Not specified';
  }
  await user.save();
  sendSuccess(res, { message: `License ${req.body.status}`, data: user.toSafeJSON() });
});

/** Current user's loyalty snapshot with tier perks. */
const myLoyalty = asyncHandler(async (req, res) => {
  const { loyalty } = req.user;
  const tier = loyaltyService.tierConfig(loyalty.tier);
  const next = loyaltyService.TIERS
    .filter((t) => t.minLifetime > loyalty.lifetimePoints)
    .sort((a, b) => a.minLifetime - b.minLifetime)[0];
  sendSuccess(res, {
    data: {
      points: loyalty.points,
      lifetimePoints: loyalty.lifetimePoints,
      tier: loyalty.tier,
      perks: { discountRate: tier.discountRate, pointsMultiplier: tier.pointsMultiplier },
      nextTier: next
        ? { tier: next.name, pointsToGo: next.minLifetime - loyalty.lifetimePoints }
        : null,
    },
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200);
  sendSuccess(res, { data: users.map((u) => u.toSafeJSON()) });
});

module.exports = { submitLicense, verifyLicense, myLoyalty, listUsers };
