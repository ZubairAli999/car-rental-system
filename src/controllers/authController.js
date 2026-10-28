'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, { statusCode: 201, message: 'Registered', data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, { message: 'Logged in', data: result });
});

const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.body.refreshToken);
  sendSuccess(res, { message: 'Token refreshed', data: tokens });
});

const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: req.user.toSafeJSON() });
});

module.exports = { register, login, refresh, me };
