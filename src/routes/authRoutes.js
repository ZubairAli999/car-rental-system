'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { auth } = require('../validators/schemas');

router.post('/register', authLimiter, validate(auth.register), ctrl.register);
router.post('/login', authLimiter, validate(auth.login), ctrl.login);
router.post('/refresh', authLimiter, validate(auth.refresh), ctrl.refresh);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
