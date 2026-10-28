'use strict';

/**
 * Tiny zero-dependency structured logger.
 * Swap for pino/winston in production without touching call sites.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, args) {
  if (LEVELS[level] > current) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] ${level.toUpperCase()}`;
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(line, ...args);
}

module.exports = {
  error: (...a) => emit('error', a),
  warn: (...a) => emit('warn', a),
  info: (...a) => emit('info', a),
  debug: (...a) => emit('debug', a),
};
