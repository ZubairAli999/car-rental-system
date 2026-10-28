'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/** Whole + partial rental days, always at least 1. */
function rentalDays(start, end) {
  const days = Math.ceil((end - start) / MS_PER_DAY);
  return Math.max(1, days);
}

/** Hours a return is late (0 if on time or early). */
function lateHours(scheduledEnd, actualReturn) {
  const diff = actualReturn - scheduledEnd;
  return diff > 0 ? Math.ceil(diff / MS_PER_HOUR) : 0;
}

/** True if date ranges [aStart,aEnd) and [bStart,bEnd) overlap. */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Days from "now" until a future date (negative if past). */
function daysUntil(date, now = new Date()) {
  return Math.round((date - now) / MS_PER_DAY);
}

module.exports = { MS_PER_DAY, MS_PER_HOUR, rentalDays, lateHours, rangesOverlap, daysUntil };
