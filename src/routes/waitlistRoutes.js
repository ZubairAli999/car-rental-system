'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/waitlistController');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { waitlist } = require('../validators/schemas');

router.use(authenticate);

router.post('/', validate(waitlist.join), ctrl.join);
router.get('/', ctrl.listMine);
router.delete('/:id', ctrl.cancel);

module.exports = router;
