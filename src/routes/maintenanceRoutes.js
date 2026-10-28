'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/maintenanceController');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { maintenance } = require('../validators/schemas');

router.use(authenticate, authorize('staff', 'admin'));

router.get('/', ctrl.list);
router.get('/due', ctrl.dueList);
router.post('/', validate(maintenance.open), ctrl.open);
router.post('/:id/close', validate(maintenance.close), ctrl.close);
router.post('/sweep', authorize('admin'), ctrl.runSweep);

module.exports = router;
