'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/dashboard', authenticate, authorize('staff', 'admin'), ctrl.dashboard);

module.exports = router;
