'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/zoneController');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { zone } = require('../validators/schemas');

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', authenticate, authorize('admin'), validate(zone.create), ctrl.create);

module.exports = router;
