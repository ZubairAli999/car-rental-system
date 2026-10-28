'use strict';

const config = require('../config/env');
const { Booking, Vehicle } = require('../models');
const { rentalDays, daysUntil } = require('../utils/dates');
const loyaltyService = require('./loyaltyService');

/**
 * Seasonal multiplier by calendar month (0 = Jan). Summer & December holidays
 * cost more; shoulder seasons are cheaper. Tune per market.
 */
const SEASONAL_BY_MONTH = [
  0.95, 0.95, 1.0, 1.05, 1.1, 1.2, 1.25, 1.25, 1.1, 1.0, 0.95, 1.2,
];

/**
 * DEMAND MULTIPLIER
 * Surge based on how much of the category's fleet is already committed during
 * the requested window. 0% utilisation → 1.0x; near-100% → up to SURGE_MAX.
 */
async function demandMultiplier(vehicle, startDate, endDate) {
  const categoryFleet = await Vehicle.countDocuments({
    category: vehicle.category,
    status: { $ne: 'retired' },
  });
  if (categoryFleet === 0) return 1;

  // Bookings in the same category that overlap the requested window.
  const overlapping = await Booking.find({
    status: { $in: Booking.BLOCKING_STATUSES },
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  })
    .populate({ path: 'vehicle', select: 'category' })
    .lean();

  const committed = overlapping.filter(
    (b) => b.vehicle && b.vehicle.category === vehicle.category
  ).length;

  const utilisation = Math.min(1, committed / categoryFleet);
  // Smooth curve: quadratic so surge only bites when the fleet is tight.
  const surge = 1 + (config.pricing.surgeMaxMultiplier - 1) * utilisation ** 2;
  return Math.round(surge * 100) / 100;
}

/** Average seasonal multiplier across the rental window's months. */
function seasonalMultiplier(startDate, endDate) {
  const months = new Set();
  const cur = new Date(startDate);
  while (cur <= endDate) {
    months.add(cur.getMonth());
    cur.setDate(cur.getDate() + 1);
  }
  const vals = [...months].map((m) => SEASONAL_BY_MONTH[m]);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 100) / 100;
}

/**
 * LEAD-TIME DISCOUNT: book early, save more. Linear from 0 (same-day) up to
 * LEAD_TIME_DISCOUNT_MAX at 30+ days out.
 */
function leadTimeDiscountRate(startDate, now = new Date()) {
  const lead = Math.max(0, daysUntil(startDate, now));
  const rate = Math.min(config.pricing.leadTimeDiscountMax, (lead / 30) * config.pricing.leadTimeDiscountMax);
  return Math.round(rate * 1000) / 1000;
}

/**
 * Produce a full, transparent price quote for a vehicle + window + user.
 * Every factor is returned so the UI can show the customer exactly why the
 * price is what it is.
 */
async function quote({ vehicle, startDate, endDate, user, now = new Date() }) {
  const days = rentalDays(startDate, endDate);
  const basePerDay = vehicle.basePricePerDay;
  const baseAmount = basePerDay * days;

  const demand = await demandMultiplier(vehicle, startDate, endDate);
  const seasonal = seasonalMultiplier(startDate, endDate);
  const leadRate = leadTimeDiscountRate(startDate, now);
  const loyaltyRate = loyaltyService.discountRateForUser(user);

  // Apply multipliers, then stack the two discount rates.
  const afterMultipliers = baseAmount * demand * seasonal;
  const discountRate = Math.min(0.5, leadRate + loyaltyRate); // cap total discount
  const subtotal = Math.round(afterMultipliers * (1 - discountRate) * 100) / 100;

  const insuranceFee = config.business.insuranceFeePerDay * days;
  const taxRate = config.business.taxRate;
  const taxAmount = Math.round((subtotal + insuranceFee) * taxRate * 100) / 100;
  const totalAmount = Math.round((subtotal + insuranceFee + taxAmount) * 100) / 100;

  return {
    currency: user?.preferredCurrency || config.business.defaultCurrency,
    days,
    basePerDay,
    baseAmount: Math.round(baseAmount * 100) / 100,
    demandMultiplier: demand,
    seasonalMultiplier: seasonal,
    leadTimeDiscountRate: leadRate,
    loyaltyDiscountRate: loyaltyRate,
    subtotal,
    insuranceFee,
    taxRate,
    taxAmount,
    totalAmount,
  };
}

module.exports = {
  SEASONAL_BY_MONTH,
  demandMultiplier,
  seasonalMultiplier,
  leadTimeDiscountRate,
  quote,
};
