'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { Review, Booking, Vehicle } = require('../models');
const ApiError = require('../utils/ApiError');

/** A customer may review only a completed booking they own, once. */
const create = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (String(booking.user) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only review your own booking');
  }
  if (booking.status !== 'completed') {
    throw ApiError.conflict('Only completed bookings can be reviewed');
  }
  const existing = await Review.findOne({ booking: booking._id });
  if (existing) throw ApiError.conflict('This booking has already been reviewed');

  const review = await Review.create({
    booking: booking._id,
    vehicle: booking.vehicle,
    user: req.user._id,
    rating: req.body.rating,
    cleanliness: req.body.cleanliness,
    condition: req.body.condition,
    comment: req.body.comment,
  });

  // Recompute the vehicle's rolling average from all its reviews.
  const agg = await Review.aggregate([
    { $match: { vehicle: booking.vehicle } },
    { $group: { _id: '$vehicle', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (agg[0]) {
    await Vehicle.findByIdAndUpdate(booking.vehicle, {
      'rating.average': Math.round(agg[0].avg * 10) / 10,
      'rating.count': agg[0].count,
    });
  }

  sendSuccess(res, { statusCode: 201, message: 'Review submitted', data: review });
});

const listForVehicle = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ vehicle: req.params.vehicleId })
    .populate('user', 'name')
    .sort({ createdAt: -1 });
  sendSuccess(res, { data: reviews });
});

module.exports = { create, listForVehicle };
