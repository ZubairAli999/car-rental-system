'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { Zone } = require('../models');
const ApiError = require('../utils/ApiError');

const create = asyncHandler(async (req, res) => {
  const zone = await Zone.create(req.body);
  sendSuccess(res, { statusCode: 201, message: 'Zone created', data: zone });
});

const list = asyncHandler(async (req, res) => {
  const zones = await Zone.find({ isActive: true }).sort({ city: 1, name: 1 });
  sendSuccess(res, { data: zones });
});

const getOne = asyncHandler(async (req, res) => {
  const zone = await Zone.findById(req.params.id);
  if (!zone) throw ApiError.notFound('Zone not found');
  sendSuccess(res, { data: zone });
});

module.exports = { create, list, getOne };
