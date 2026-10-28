'use strict';

const app = require('./src/app');
const { connectDB, disconnectDB } = require('./src/config/db');
const { startJobs } = require('./src/jobs');
const config = require('./src/config/env');
const logger = require('./src/config/logger');

let server;
let jobs = [];

async function start() {
  try {
    await connectDB();
    jobs = startJobs();

    server = app.listen(config.port, () => {
      logger.info(`DriveNow API listening on port ${config.port} (${config.env})`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  jobs.forEach((task) => task.stop());
  if (server) server.close();
  await disconnectDB();
  process.exit(0);
}

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

start();
