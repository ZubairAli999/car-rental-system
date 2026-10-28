'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { Waitlist } = require('../models');
const ApiError = require('../utils/ApiError');
const waitlistService = require('../services/waitlistService');

const join = asyncHandler(async (req, res) => {
  const { vehicleId, category, zoneId, desiredStart, desiredEnd } = req.body;
  if (!vehicleId && !category) {
    throw ApiError.badRequest('Provide a vehicleId or a category to wait on');
  }
  const entry = await waitlistService.join({
    user: req.user,
    vehicleId,
    category,
    zoneId,
    desiredStart: new Date(desiredStart),
    desiredEnd: new Date(desiredEnd),
  });
  sendSuccess(res, {
    statusCode: 201,
    message: `Added to waitlist at position ${entry.position}`,
    data: entry,
  });
});

const listMine = asyncHandler(async (req, res) => {
  const entries = await Waitlist.find({ user: req.user._id })
    .populate('vehicle', 'make model licensePlate')
    .sort({ createdAt: -1 });
  sendSuccess(res, { data: entries });
});

const cancel = asyncHandler(async (req, res) => {
  const entry = await Waitlist.findOne({ _id: req.params.id, user: req.user._id });
  if (!entry) throw ApiError.notFound('Waitlist entry not found');
  entry.status = 'cancelled';
  await entry.save();
  sendSuccess(res, { message: 'Waitlist entry cancelled', data: entry });
});

module.exports = { join, listMine, cancel };
