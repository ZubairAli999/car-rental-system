'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/reviewController');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { review } = require('../validators/schemas');

router.post('/', authenticate, validate(review.create), ctrl.create);

module.exports = router;
