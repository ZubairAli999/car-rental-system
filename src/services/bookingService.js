'use strict';

const { Booking, Vehicle, Zone, User } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const { reference } = require('../utils/ids');
const { lateHours } = require('../utils/dates');

const availabilityService = require('./availabilityService');
const pricingService = require('./pricingService');
const carbonService = require('./carbonService');
const loyaltyService = require('./loyaltyService');
const geofenceService = require('./geofenceService');
const paymentService = require('./paymentService');
const waitlistService = require('./waitlistService');

/**
 * CREATE a booking (status: pending). Validates license, dates, availability
 * and geofence zones, then prices it with the dynamic engine and attaches a
 * carbon profile + greener-alternative suggestion.
 */
async function createBooking(user, { vehicleId, pickupZoneId, returnZoneId, startDate, endDate }) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Invalid start or end date');
  }
  if (end <= start) throw ApiError.badRequest('endDate must be after startDate');
  if (start < new Date(Date.now() - 60 * 1000)) {
    throw ApiError.badRequest('startDate cannot be in the past');
  }
  if (!user.canRent()) {
    throw ApiError.forbidden('A verified, unexpired driver license is required to book');
  }

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw ApiError.notFound('Vehicle not found');

  const availability = await availabilityService.isVehicleAvailable(vehicleId, start, end);
  if (!availability.available) {
    throw ApiError.conflict('Vehicle is not available for the selected dates', availability);
  }

  const pickupZone = await Zone.findById(pickupZoneId || vehicle.homeZone);
  const returnZone = await Zone.findById(returnZoneId || vehicle.homeZone);
  if (!pickupZone || !returnZone) throw ApiError.badRequest('Invalid pickup/return zone');

  const pricing = await pricingService.quote({ vehicle, startDate: start, endDate: end, user });
  const carbon = carbonService.profileForBooking(vehicle, pricing.days);
  const greener = await carbonService.greenerAlternative(vehicle);

  const booking = await Booking.create({
    bookingNumber: reference('BK'),
    user: user._id,
    vehicle: vehicle._id,
    pickupZone: pickupZone._id,
    returnZone: returnZone._id,
    startDate: start,
    endDate: end,
    status: 'pending',
    pricing,
    carbon,
  });

  return { booking, suggestions: { greenerAlternative: greener } };
}

/**
 * CONFIRM a pending booking by charging payment. Re-checks availability to
 * guard against a race with another customer who booked the same window.
 */
async function confirmBooking(user, bookingId, { method } = {}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (String(booking.user) !== String(user._id) && user.role === 'customer') {
    throw ApiError.forbidden('Not your booking');
  }
  if (booking.status !== 'pending') {
    throw ApiError.conflict(`Cannot confirm a booking in status "${booking.status}"`);
  }

  const recheck = await availabilityService.isVehicleAvailable(
    booking.vehicle,
    booking.startDate,
    booking.endDate,
    booking._id
  );
  if (!recheck.available) {
    booking.status = 'cancelled';
    booking.cancellation = { at: new Date(), reason: 'vehicle_became_unavailable' };
    await booking.save();
    throw ApiError.conflict('Vehicle was booked by someone else; booking released', recheck);
  }

  const payment = await paymentService.charge({
    booking,
    user,
    amount: booking.pricing.totalAmount,
    currency: booking.pricing.currency,
    method,
  });

  booking.payment = payment._id;
  booking.status = 'confirmed';
  await booking.save();
  return { booking, payment };
}

/**
 * PICK UP: transition confirmed → active. Enforces the pickup geofence and
 * records the opening inspection (odometer, fuel, damage checklist).
 */
async function pickupBooking(actor, bookingId, { location, odometerKm, fuelLevelPercent, items = [] }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'confirmed') {
    throw ApiError.conflict(`Cannot pick up a booking in status "${booking.status}"`);
  }

  await geofenceService.assertWithinZone(booking.pickupZone, location, 'pickup');

  const vehicle = await Vehicle.findById(booking.vehicle);
  if (!vehicle) throw ApiError.notFound('Vehicle not found');

  booking.pickupInspection = {
    at: new Date(),
    odometerKm: odometerKm ?? vehicle.odometerKm,
    fuelLevelPercent: fuelLevelPercent ?? vehicle.fuelLevelPercent,
    location,
    items,
    inspectedBy: actor._id,
  };
  booking.status = 'active';
  await booking.save();

  vehicle.status = 'rented';
  if (location) vehicle.currentLocation = location;
  await vehicle.save();

  return booking;
}

/**
 * RETURN: transition active → completed. Enforces the return geofence,
 * computes late/fuel penalties, actual carbon, awards loyalty points, updates
 * the vehicle odometer/fuel, and notifies the next waitlisted customer.
 */
async function returnBooking(actor, bookingId, { location, odometerKm, fuelLevelPercent, items = [], damageFee = 0 }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'active') {
    throw ApiError.conflict(`Cannot return a booking in status "${booking.status}"`);
  }

  await geofenceService.assertWithinZone(booking.returnZone, location, 'return');

  const vehicle = await Vehicle.findById(booking.vehicle);
  const user = await User.findById(booking.user);

  const now = new Date();
  const penalties = [];

  // Late-return penalty
  const late = lateHours(booking.endDate, now);
  if (late > 0) {
    penalties.push({
      type: 'late_return',
      description: `${late}h late`,
      amount: late * config.business.lateReturnFeePerHour,
    });
  }

  // Fuel penalty: returned below pickup level
  const pickupFuel = booking.pickupInspection?.fuelLevelPercent ?? 100;
  const returnFuel = fuelLevelPercent ?? pickupFuel;
  const fuelDeficit = Math.max(0, pickupFuel - returnFuel);
  if (fuelDeficit > 0) {
    penalties.push({
      type: 'fuel',
      description: `Returned ${fuelDeficit}% below pickup fuel level`,
      amount: Math.round(fuelDeficit * config.business.fuelPenaltyPerPercent * 100) / 100,
    });
  }

  // Damage penalty from inspection (staff-assessed fee)
  const hasDamage = items.some((i) => i.condition === 'damaged');
  if (damageFee > 0 || hasDamage) {
    penalties.push({
      type: 'damage',
      description: hasDamage ? 'Damage recorded at return inspection' : 'Damage fee',
      amount: Number(damageFee) || 0,
    });
  }

  const penaltyTotal = Math.round(penalties.reduce((s, p) => s + p.amount, 0) * 100) / 100;

  // Actual carbon from measured distance
  const startOdo = booking.pickupInspection?.odometerKm ?? vehicle.odometerKm;
  const endOdo = odometerKm ?? startOdo;
  const actualKm = Math.max(0, endOdo - startOdo);
  const actualCo2 = carbonService.co2KgFor(actualKm, vehicle.co2PerKm);

  booking.returnInspection = {
    at: now,
    odometerKm: endOdo,
    fuelLevelPercent: returnFuel,
    location,
    items,
    inspectedBy: actor._id,
  };
  booking.penalties = penalties;
  booking.penaltyTotal = penaltyTotal;
  booking.carbon.actualKm = actualKm;
  booking.carbon.actualCo2Kg = actualCo2;
  booking.status = 'completed';

  // Loyalty: earn on the total spend (rental + penalties)
  const spend = booking.grandTotal();
  const points = loyaltyService.pointsForSpend(spend, user);
  booking.loyaltyPointsEarned = points;
  await booking.save();

  if (user) {
    const { promoted, tier } = loyaltyService.awardPoints(user, points);
    await user.save();
    booking._loyalty = { points, promoted, tier }; // transient, for controller response
  }

  // Update vehicle state and release it
  vehicle.odometerKm = endOdo;
  vehicle.fuelLevelPercent = returnFuel;
  if (location) vehicle.currentLocation = location;
  vehicle.status = vehicle.isServiceDue(now) ? 'maintenance' : 'available';
  if (vehicle.status === 'maintenance') vehicle.maintenance.serviceDueFlag = true;
  await vehicle.save();

  // Waitlist: tell the next person in line the car is free
  await waitlistService.notifyNext(vehicle._id, booking.startDate, booking.endDate);

  return booking;
}

/**
 * CANCEL a pending/confirmed booking. Refund scales with lead time; releasing
 * the vehicle triggers a waitlist notification.
 */
async function cancelBooking(user, bookingId, reason = 'customer_cancelled') {
  const booking = await Booking.findById(bookingId).populate('payment');
  if (!booking) throw ApiError.notFound('Booking not found');
  if (String(booking.user) !== String(user._id) && user.role === 'customer') {
    throw ApiError.forbidden('Not your booking');
  }
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw ApiError.conflict(`Cannot cancel a booking in status "${booking.status}"`);
  }

  // Refund policy: >7d → 100%, 2–7d → 50%, <2d → 0% of rental total.
  const hoursToStart = (booking.startDate - new Date()) / (60 * 60 * 1000);
  let refundRate = 0;
  if (hoursToStart >= 24 * 7) refundRate = 1;
  else if (hoursToStart >= 24 * 2) refundRate = 0.5;

  let refundAmount = 0;
  if (booking.payment && booking.status === 'confirmed') {
    refundAmount = Math.round(booking.pricing.totalAmount * refundRate * 100) / 100;
    if (refundAmount > 0) await paymentService.refund(booking.payment, refundAmount, reason);
  }

  booking.status = 'cancelled';
  booking.cancellation = { at: new Date(), reason, refundAmount };
  await booking.save();

  await waitlistService.notifyNext(booking.vehicle, booking.startDate, booking.endDate);

  return { booking, refundAmount, refundRate };
}

module.exports = {
  createBooking,
  confirmBooking,
  pickupBooking,
  returnBooking,
  cancelBooking,
};
