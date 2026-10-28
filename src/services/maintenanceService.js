'use strict';

const { Vehicle, MaintenanceLog, Booking } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Open a maintenance record. If it blocks availability, the vehicle is moved
 * to "maintenance" status so it stops appearing in searches immediately.
 */
async function openLog({ vehicleId, type, description, cost, odometerKm, performedBy, blocksAvailability = true }) {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw ApiError.notFound('Vehicle not found');

  const log = await MaintenanceLog.create({
    vehicle: vehicle._id,
    type,
    description,
    cost,
    odometerKm: odometerKm ?? vehicle.odometerKm,
    performedBy,
    blocksAvailability,
  });

  if (blocksAvailability && vehicle.status === 'available') {
    vehicle.status = 'maintenance';
    await vehicle.save();
  }
  return log;
}

/**
 * Close a maintenance record. Resets the service counters and, if no other
 * open blocking log remains, returns the vehicle to "available".
 */
async function closeLog(logId, { odometerKm, resetService = true } = {}) {
  const log = await MaintenanceLog.findById(logId);
  if (!log) throw ApiError.notFound('Maintenance log not found');
  if (!log.isOpen) throw ApiError.conflict('Maintenance log already closed');

  log.isOpen = false;
  log.endDate = new Date();
  await log.save();

  const vehicle = await Vehicle.findById(log.vehicle);
  if (vehicle) {
    if (resetService && (log.type === 'routine' || log.type === 'inspection')) {
      vehicle.maintenance.lastServiceOdometerKm = odometerKm ?? vehicle.odometerKm;
      vehicle.maintenance.lastServiceDate = new Date();
      vehicle.maintenance.serviceDueFlag = false;
      vehicle.maintenance.nextServiceDate = new Date(
        Date.now() + 180 * 24 * 60 * 60 * 1000 // ~6 months out
      );
    }
    const otherBlocking = await MaintenanceLog.exists({
      vehicle: vehicle._id,
      isOpen: true,
      blocksAvailability: true,
    });
    if (!otherBlocking && vehicle.status === 'maintenance') {
      vehicle.status = 'available';
    }
    await vehicle.save();
  }
  return log;
}

/**
 * PREDICTIVE MAINTENANCE SWEEP (run by cron).
 * Flags vehicles past their service threshold. A car that is free right now is
 * proactively moved to "maintenance"; a rented one is only flagged and will be
 * caught when it returns.
 */
async function runServiceSweep(now = new Date()) {
  const vehicles = await Vehicle.find({ status: { $in: ['available', 'rented'] } });
  const flagged = [];

  for (const vehicle of vehicles) {
    if (!vehicle.isServiceDue(now)) continue;

    vehicle.maintenance.serviceDueFlag = true;

    // Only auto-block if the car is free and has no upcoming booking today.
    if (vehicle.status === 'available') {
      const upcoming = await Booking.exists({
        vehicle: vehicle._id,
        status: { $in: Booking.BLOCKING_STATUSES },
        startDate: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      });
      if (!upcoming) {
        vehicle.status = 'maintenance';
        await MaintenanceLog.create({
          vehicle: vehicle._id,
          type: 'routine',
          description: `Auto-flagged: service due (${vehicle.kmSinceService()} km since last service)`,
          odometerKm: vehicle.odometerKm,
          blocksAvailability: true,
        });
      }
    }
    await vehicle.save();
    flagged.push(vehicle._id);
  }

  if (flagged.length) logger.info(`[maintenance] Service sweep flagged ${flagged.length} vehicle(s)`);
  return flagged;
}

module.exports = { openLog, closeLog, runServiceSweep };
