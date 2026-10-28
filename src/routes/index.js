'use strict';

const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/zones', require('./zoneRoutes'));
router.use('/vehicles', require('./vehicleRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/waitlist', require('./waitlistRoutes'));
router.use('/reviews', require('./reviewRoutes'));
router.use('/maintenance', require('./maintenanceRoutes'));
router.use('/analytics', require('./analyticsRoutes'));

module.exports = router;
