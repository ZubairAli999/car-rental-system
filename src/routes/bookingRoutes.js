'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { booking } = require('../validators/schemas');

router.use(authenticate);

router.post('/quote', validate(booking.quote), ctrl.quote);
router.post('/', validate(booking.create), ctrl.create);
router.get('/', ctrl.listMine);
router.get('/:id', ctrl.getOne);

router.post('/:id/confirm', validate(booking.confirm), ctrl.confirm);
router.post('/:id/cancel', validate(booking.cancel), ctrl.cancel);

// Pickup/return are performed by staff at the zone counter.
router.post('/:id/pickup', authorize('staff', 'admin'), validate(booking.pickup), ctrl.pickup);
router.post('/:id/return', authorize('staff', 'admin'), validate(booking.return), ctrl.returnVehicle);

module.exports = router;
