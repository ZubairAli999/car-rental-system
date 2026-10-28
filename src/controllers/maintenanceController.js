'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { MaintenanceLog, Vehicle } = require('../models');
const maintenanceService = require('../services/maintenanceService');

const open = asyncHandler(async (req, res) => {
  const log = await maintenanceService.openLog({ ...req.body, vehicleId: req.body.vehicleId });
  sendSuccess(res, { statusCode: 201, message: 'Maintenance opened', data: log });
});

const close = asyncHandler(async (req, res) => {
  const log = await maintenanceService.closeLog(req.params.id, req.body);
  sendSuccess(res, { message: 'Maintenance closed', data: log });
});

const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.vehicleId) filter.vehicle = req.query.vehicleId;
  if (req.query.open === 'true') filter.isOpen = true;
  const logs = await MaintenanceLog.find(filter)
    .populate('vehicle', 'make model licensePlate')
    .sort({ createdAt: -1 });
  sendSuccess(res, { data: logs });
});

/** Vehicles flagged by the predictive service sweep. */
const dueList = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find({ 'maintenance.serviceDueFlag': true }).select(
    'make model licensePlate odometerKm maintenance status'
  );
  sendSuccess(res, { data: vehicles, meta: { count: vehicles.length } });
});

/** Manually trigger the predictive sweep (admin). */
const runSweep = asyncHandler(async (req, res) => {
  const flagged = await maintenanceService.runServiceSweep();
  sendSuccess(res, { message: 'Service sweep complete', data: { flaggedCount: flagged.length } });
});

module.exports = { open, close, list, dueList, runSweep };
