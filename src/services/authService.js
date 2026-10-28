'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

function signTokens(user) {
  const payload = { sub: String(user._id), role: user.role };
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
  return { accessToken, refreshToken };
}

async function register({ name, email, password, phone, role }) {
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw ApiError.conflict('Email already registered');

  const user = new User({
    name,
    email,
    phone,
    // Only allow self-registration as customer; elevated roles are seeded/admin-set.
    role: role === 'staff' || role === 'admin' ? 'customer' : 'customer',
  });
  await user.setPassword(password);
  await user.save();

  return { user: user.toSafeJSON(), ...signTokens(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive) throw ApiError.unauthorized('Invalid credentials');

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  user.lastLoginAt = new Date();
  await user.save();

  return { user: user.toSafeJSON(), ...signTokens(user) };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token required');
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('User no longer active');
  return signTokens(user);
}

module.exports = { signTokens, register, login, refresh };
