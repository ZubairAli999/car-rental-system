'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { globalLimiter } = require('./middleware/rateLimit');
const config = require('./config/env');

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (!config.isProd) app.use(morgan('dev'));

app.use(globalLimiter);

// Health check
app.get('/health', (req, res) =>
  res.json({ success: true, status: 'ok', uptime: process.uptime() })
);

// API
app.use('/api/v1', routes);

// 404 + error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
