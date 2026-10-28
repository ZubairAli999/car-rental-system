'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/vehicleController');
const reviewCtrl = require('../controllers/reviewController');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { vehicle } = require('../validators/schemas');

// Public
router.get('/search', validate(vehicle.search, 'query'), ctrl.search);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:vehicleId/reviews', reviewCtrl.listForVehicle);

// Staff/admin management
router.post('/', authenticate, authorize('staff', 'admin'), validate(vehicle.create), ctrl.create);
router.patch('/:id', authenticate, authorize('staff', 'admin'), validate(vehicle.update), ctrl.update);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);

module.exports = router;
