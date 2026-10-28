'use strict';

const { Booking, Vehicle } = require('../models');

/**
 * Is a specific vehicle free for [startDate, endDate)?
 * Free means: not retired/in maintenance AND no blocking booking overlaps.
 * `excludeBookingId` lets an edit ignore its own existing booking.
 */
async function isVehicleAvailable(vehicleId, startDate, endDate, excludeBookingId = null) {
  const vehicle = await Vehicle.findById(vehicleId).lean();
  if (!vehicle) return { available: false, reason: 'vehicle_not_found' };
  if (vehicle.status === 'retired') return { available: false, reason: 'retired' };
  if (vehicle.status === 'maintenance') return { available: false, reason: 'maintenance' };

  const clash = await Booking.findOne({
    _id: excludeBookingId ? { $ne: excludeBookingId } : { $exists: true },
    vehicle: vehicleId,
    status: { $in: Booking.BLOCKING_STATUSES },
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  }).lean();

  if (clash) return { available: false, reason: 'booked', conflictBookingId: clash._id };
  return { available: true };
}

/**
 * Search available vehicles for a window with optional filters, excluding any
 * with an overlapping blocking booking. Used by the public search endpoint.
 */
async function searchAvailable({ startDate, endDate, category, zoneId, seats, fuelType }) {
  const vehicleFilter = { status: 'available' };
  if (category) vehicleFilter.category = category;
  if (zoneId) vehicleFilter.homeZone = zoneId;
  if (fuelType) vehicleFilter.fuelType = fuelType;
  if (seats) vehicleFilter.seats = { $gte: Number(seats) };

  const candidates = await Vehicle.find(vehicleFilter).populate('homeZone').lean();
  if (candidates.length === 0) return [];

  const ids = candidates.map((v) => v._id);
  const clashes = await Booking.find({
    vehicle: { $in: ids },
    status: { $in: Booking.BLOCKING_STATUSES },
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  })
    .select('vehicle')
    .lean();

  const busy = new Set(clashes.map((c) => String(c.vehicle)));
  return candidates.filter((v) => !busy.has(String(v._id)));
}

module.exports = { isVehicleAvailable, searchAvailable };
