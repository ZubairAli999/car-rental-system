'use strict';

const cron = require('node-cron');
const logger = require('../config/logger');
const { Booking } = require('../models');
const maintenanceService = require('../services/maintenanceService');
const waitlistService = require('../services/waitlistService');

/**
 * Mark confirmed bookings whose start window has fully elapsed without pickup
 * as no_show, freeing the vehicle and notifying the waitlist.
 */
async function markNoShows(now = new Date()) {
  const grace = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h grace
  const stale = await Booking.find({ status: 'confirmed', startDate: { $lt: grace } });
  for (const booking of stale) {
    booking.status = 'no_show';
    await booking.save();
    await waitlistService.notifyNext(booking.vehicle, booking.startDate, booking.endDate);
  }
  if (stale.length) logger.info(`[jobs] Marked ${stale.length} booking(s) as no_show`);
  return stale.length;
}

/**
 * Register all scheduled jobs. Returns the started tasks so the server can
 * stop them on graceful shutdown.
 */
function startJobs() {
  const tasks = [];

  // Predictive maintenance sweep — every day at 02:00.
  tasks.push(
    cron.schedule('0 2 * * *', async () => {
      try {
        await maintenanceService.runServiceSweep();
      } catch (err) {
        logger.error('[jobs] Service sweep failed', err.message);
      }
    })
  );

  // Expire stale waitlist holds — every 15 minutes.
  tasks.push(
    cron.schedule('*/15 * * * *', async () => {
      try {
        const n = await waitlistService.expireStaleHolds();
        if (n) logger.info(`[jobs] Expired ${n} waitlist hold(s)`);
      } catch (err) {
        logger.error('[jobs] Waitlist expiry failed', err.message);
      }
    })
  );

  // No-show sweep — every hour.
  tasks.push(
    cron.schedule('0 * * * *', async () => {
      try {
        await markNoShows();
      } catch (err) {
        logger.error('[jobs] No-show sweep failed', err.message);
      }
    })
  );

  logger.info(`[jobs] Started ${tasks.length} scheduled job(s)`);
  return tasks;
}

module.exports = { startJobs, markNoShows };
