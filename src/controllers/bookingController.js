'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { Booking, Vehicle } = require('../models');
const ApiError = require('../utils/ApiError');
const bookingService = require('../services/bookingService');
const pricingService = require('../services/pricingService');

/** Preview a price quote without creating a booking. */
const quote = asyncHandler(async (req, res) => {
  const { vehicleId, startDate, endDate } = req.body;
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw ApiError.notFound('Vehicle not found');
  const pricing = await pricingService.quote({
    vehicle,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    user: req.user,
  });
  sendSuccess(res, { data: pricing });
});

const create = asyncHandler(async (req, res) => {
  const result = await bookingService.createBooking(req.user, req.body);
  sendSuccess(res, { statusCode: 201, message: 'Booking created (pending payment)', data: result });
});

const confirm = asyncHandler(async (req, res) => {
  const result = await bookingService.confirmBooking(req.user, req.params.id, req.body);
  sendSuccess(res, { message: 'Booking confirmed', data: result });
});

const pickup = asyncHandler(async (req, res) => {
  const booking = await bookingService.pickupBooking(req.user, req.params.id, req.body);
  sendSuccess(res, { message: 'Vehicle picked up', data: booking });
});

const returnVehicle = asyncHandler(async (req, res) => {
  const booking = await bookingService.returnBooking(req.user, req.params.id, req.body);
  sendSuccess(res, {
    message: 'Vehicle returned',
    data: {
      booking,
      loyalty: booking._loyalty,
      penaltyTotal: booking.penaltyTotal,
      grandTotal: booking.grandTotal(),
    },
  });
});

const cancel = asyncHandler(async (req, res) => {
  const result = await bookingService.cancelBooking(req.user, req.params.id, req.body.reason);
  sendSuccess(res, { message: 'Booking cancelled', data: result });
});

/** Current user's bookings (admins/staff see all). */
const listMine = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'customer' ? { user: req.user._id } : {};
  if (req.query.status) filter.status = req.query.status;
  const bookings = await Booking.find(filter)
    .populate('vehicle', 'make model licensePlate category')
    .populate('pickupZone returnZone', 'name code')
    .sort({ createdAt: -1 });
  sendSuccess(res, { data: bookings });
});

const getOne = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('vehicle')
    .populate('pickupZone returnZone')
    .populate('payment');
  if (!booking) throw ApiError.notFound('Booking not found');
  if (req.user.role === 'customer' && String(booking.user) !== String(req.user._id)) {
    throw ApiError.forbidden('Not your booking');
  }
  sendSuccess(res, { data: booking });
});

module.exports = { quote, create, confirm, pickup, returnVehicle, cancel, listMine, getOne };
