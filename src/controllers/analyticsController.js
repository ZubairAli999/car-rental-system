'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { Booking, Vehicle, User } = require('../models');

/**
 * Admin dashboard: fleet utilisation, revenue, loyalty & the fleet-wide
 * carbon footprint — a consolidated snapshot most rental backends don't expose.
 */
const dashboard = asyncHandler(async (req, res) => {
  const [fleetByStatus, revenueAgg, carbonAgg, topVehicles, tierBreakdown] = await Promise.all([
    Vehicle.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'active', 'completed'] } } },
      {
        $group: {
          _id: null,
          gross: { $sum: '$pricing.totalAmount' },
          penalties: { $sum: '$penaltyTotal' },
          bookings: { $sum: 1 },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          estimatedCo2Kg: { $sum: '$carbon.estimatedCo2Kg' },
          actualCo2Kg: { $sum: '$carbon.actualCo2Kg' },
          totalKm: { $sum: '$carbon.actualKm' },
        },
      },
    ]),
    Booking.aggregate([
      { $group: { _id: '$vehicle', bookings: { $sum: 1 }, revenue: { $sum: '$pricing.totalAmount' } } },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      {
        $lookup: { from: 'vehicles', localField: '_id', foreignField: '_id', as: 'vehicle' },
      },
      { $unwind: '$vehicle' },
      {
        $project: {
          bookings: 1,
          revenue: 1,
          label: { $concat: ['$vehicle.make', ' ', '$vehicle.model'] },
          plate: '$vehicle.licensePlate',
        },
      },
    ]),
    User.aggregate([{ $group: { _id: '$loyalty.tier', count: { $sum: 1 } } }]),
  ]);

  const fleet = fleetByStatus.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});
  const totalFleet = Object.values(fleet).reduce((a, b) => a + b, 0);
  const rented = fleet.rented || 0;

  sendSuccess(res, {
    data: {
      fleet: {
        byStatus: fleet,
        total: totalFleet,
        utilisationPercent: totalFleet ? Math.round((rented / totalFleet) * 100) : 0,
      },
      revenue: revenueAgg[0] || { gross: 0, penalties: 0, bookings: 0 },
      carbon: carbonAgg[0] || { estimatedCo2Kg: 0, actualCo2Kg: 0, totalKm: 0 },
      topVehicles,
      loyaltyTiers: tierBreakdown.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {}),
    },
  });
});

module.exports = { dashboard };
