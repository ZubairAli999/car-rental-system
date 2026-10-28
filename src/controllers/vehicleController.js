'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { Vehicle } = require('../models');
const ApiError = require('../utils/ApiError');
const availabilityService = require('../services/availabilityService');
const carbonService = require('../services/carbonService');

const create = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.create(req.body);
  sendSuccess(res, { statusCode: 201, message: 'Vehicle created', data: vehicle });
});

const update = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!vehicle) throw ApiError.notFound('Vehicle not found');
  sendSuccess(res, { message: 'Vehicle updated', data: vehicle });
});

const remove = asyncHandler(async (req, res) => {
  // Soft-retire rather than delete to preserve booking history.
  const vehicle = await Vehicle.findByIdAndUpdate(
    req.params.id,
    { status: 'retired' },
    { new: true }
  );
  if (!vehicle) throw ApiError.notFound('Vehicle not found');
  sendSuccess(res, { message: 'Vehicle retired', data: vehicle });
});

const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  const vehicles = await Vehicle.find(filter).populate('homeZone').sort({ createdAt: -1 });
  sendSuccess(res, { data: vehicles });
});

const getOne = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id).populate('homeZone');
  if (!vehicle) throw ApiError.notFound('Vehicle not found');
  const eco = carbonService.ecoScore(vehicle.co2PerKm);
  sendSuccess(res, { data: { ...vehicle.toObject(), ecoScore: eco } });
});

/** Public availability search with carbon profile annotated per result. */
const search = asyncHandler(async (req, res) => {
  const { startDate, endDate, category, zoneId, seats, fuelType } = req.query;
  const results = await availabilityService.searchAvailable({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    category,
    zoneId,
    seats,
    fuelType,
  });
  const annotated = results.map((v) => ({
    ...v,
    ecoScore: carbonService.ecoScore(v.co2PerKm),
  }));
  sendSuccess(res, { data: annotated, meta: { count: annotated.length } });
});

module.exports = { create, update, remove, list, getOne, search };
