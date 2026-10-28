'use strict';

const { Zone } = require('../models');
const ApiError = require('../utils/ApiError');
const { isWithinRadius, haversineMeters } = require('../utils/geo');

/**
 * Validate that a reported pickup/return coordinate falls inside the zone's
 * geofence. Throws a 422 with the overshoot distance if it does not.
 */
async function assertWithinZone(zoneId, point, action = 'pickup') {
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
    throw ApiError.badRequest(`A ${action} location {lat,lng} is required`);
  }
  const zone = await Zone.findById(zoneId).lean();
  if (!zone) throw ApiError.notFound('Zone not found');

  if (!isWithinRadius(point, zone.center, zone.radiusMeters)) {
    const distance = Math.round(haversineMeters(point, zone.center));
    throw ApiError.unprocessable(
      `${action} location is outside the "${zone.name}" zone`,
      { distanceMeters: distance, allowedRadiusMeters: zone.radiusMeters }
    );
  }
  return zone;
}

module.exports = { assertWithinZone };
