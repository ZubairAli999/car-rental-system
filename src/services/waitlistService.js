'use strict';

const { Waitlist } = require('../models');
const { rangesOverlap } = require('../utils/dates');
const logger = require('../config/logger');

const HOLD_WINDOW_MS = 2 * 60 * 60 * 1000; // 2-hour hold once notified

/**
 * Add a user to a vehicle's waitlist for a window and return their position.
 */
async function join({ user, vehicleId, category, zoneId, desiredStart, desiredEnd }) {
  const entry = await Waitlist.create({
    user: user._id,
    vehicle: vehicleId,
    category,
    pickupZone: zoneId,
    desiredStart,
    desiredEnd,
    status: 'waiting',
  });

  const ahead = await Waitlist.countDocuments({
    vehicle: vehicleId,
    status: 'waiting',
    createdAt: { $lt: entry.createdAt },
  });
  entry.position = ahead + 1;
  await entry.save();
  return entry;
}

/**
 * Called when a vehicle frees up (booking cancelled/completed). Finds the
 * oldest waiting entry whose window overlaps the freed window, marks it
 * `notified`, and places a time-boxed hold. Returns the notified entry (or null).
 *
 * In production this would also enqueue an email/push via a notifier.
 */
async function notifyNext(vehicleId, freedStart, freedEnd, now = new Date()) {
  const waiting = await Waitlist.find({ vehicle: vehicleId, status: 'waiting' })
    .sort({ createdAt: 1 })
    .populate('user', 'email name');

  const match = waiting.find((w) =>
    rangesOverlap(w.desiredStart, w.desiredEnd, freedStart, freedEnd)
  );
  if (!match) return null;

  match.status = 'notified';
  match.notifiedAt = now;
  match.holdExpiresAt = new Date(now.getTime() + HOLD_WINDOW_MS);
  await match.save();

  logger.info(
    `[waitlist] Notified ${match.user?.email} that vehicle ${vehicleId} is available`
  );
  return match;
}

/** Expire holds that elapsed without conversion, freeing the slot downstream. */
async function expireStaleHolds(now = new Date()) {
  const res = await Waitlist.updateMany(
    { status: 'notified', holdExpiresAt: { $lt: now } },
    { $set: { status: 'expired' } }
  );
  return res.modifiedCount || 0;
}

module.exports = { HOLD_WINDOW_MS, join, notifyNext, expireStaleHolds };
