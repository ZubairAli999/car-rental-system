'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { user } = require('../validators/schemas');

router.use(authenticate);

router.post('/me/license', validate(user.submitLicense), ctrl.submitLicense);
router.get('/me/loyalty', ctrl.myLoyalty);

// Staff/admin
router.get('/', authorize('staff', 'admin'), ctrl.listUsers);
router.patch(
  '/:id/license',
  authorize('staff', 'admin'),
  validate(user.verifyLicense),
  ctrl.verifyLicense
);

module.exports = router;
