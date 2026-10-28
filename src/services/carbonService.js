'use strict';

const Vehicle = require('../models/Vehicle');

// Assumed average daily distance (km) when estimating a booking's footprint.
const ASSUMED_KM_PER_DAY = 120;

// Reference "dirtiest" emission (petrol) used to normalise the eco-score.
const WORST_CO2_PER_KM = 200;
const BEST_CO2_PER_KM = 40;

/** Estimate distance for a booking from its day count. */
function estimateKm(days, kmPerDay = ASSUMED_KM_PER_DAY) {
  return days * kmPerDay;
}

/** Kilograms of CO2 for a distance given a vehicle's gCO2/km. */
function co2KgFor(km, co2PerKm) {
  return Math.round(((km * co2PerKm) / 1000) * 100) / 100;
}

/**
 * Eco-score 0–100 (higher = greener), derived from the vehicle's emission
 * intensity relative to the cleanest/dirtiest references in the fleet.
 */
function ecoScore(co2PerKm) {
  const clamped = Math.min(WORST_CO2_PER_KM, Math.max(BEST_CO2_PER_KM, co2PerKm));
  const score = 100 * (1 - (clamped - BEST_CO2_PER_KM) / (WORST_CO2_PER_KM - BEST_CO2_PER_KM));
  return Math.round(score);
}

/** Full carbon profile for a booking of `days` days on `vehicle`. */
function profileForBooking(vehicle, days) {
  const km = estimateKm(days);
  const co2 = co2KgFor(km, vehicle.co2PerKm);
  return {
    estimatedKm: km,
    estimatedCo2Kg: co2,
    ecoScore: ecoScore(vehicle.co2PerKm),
  };
}

/**
 * Suggest a greener available alternative in the same category: the vehicle
 * with the lowest co2PerKm that still beats the chosen one. Returns null if
 * nothing cleaner is available.
 */
async function greenerAlternative(vehicle) {
  const candidate = await Vehicle.findOne({
    _id: { $ne: vehicle._id },
    category: vehicle.category,
    status: 'available',
    co2PerKm: { $lt: vehicle.co2PerKm },
  })
    .sort({ co2PerKm: 1 })
    .lean();

  if (!candidate) return null;
  return {
    vehicleId: candidate._id,
    label: `${candidate.make} ${candidate.model}`,
    fuelType: candidate.fuelType,
    co2PerKm: candidate.co2PerKm,
    ecoScore: ecoScore(candidate.co2PerKm),
    co2SavedPercent: Math.round((1 - candidate.co2PerKm / vehicle.co2PerKm) * 100),
  };
}

module.exports = {
  ASSUMED_KM_PER_DAY,
  estimateKm,
  co2KgFor,
  ecoScore,
  profileForBooking,
  greenerAlternative,
};
