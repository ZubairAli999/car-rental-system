'use strict';

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function randomChunk(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Human-friendly, collision-resistant reference like "BK-7FQ3K9".
 */
function reference(prefix) {
  return `${prefix}-${randomChunk(6)}`;
}

module.exports = { reference, randomChunk };
