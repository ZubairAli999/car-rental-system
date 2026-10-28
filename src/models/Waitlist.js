'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const STATUS = ['waiting', 'notified', 'converted', 'expired', 'cancelled'];

/**
 * A customer's request to be notified when a specific vehicle (or any vehicle
 * in a category) frees up for their desired window. The waitlist service
 * walks this queue FIFO when a booking is cancelled or completed.
 */
const waitlistSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    category: { type: String }, // alternative to a specific vehicle
    pickupZone: { type: Schema.Types.ObjectId, ref: 'Zone' },
    desiredStart: { type: Date, required: true },
    desiredEnd: { type: Date, required: true },
    status: { type: String, enum: STATUS, default: 'waiting', index: true },
    notifiedAt: { type: Date },
    // Hold window: once notified, the slot is reserved for this user until expiry.
    holdExpiresAt: { type: Date },
    position: { type: Number }, // cached FIFO position for display
  },
  { timestamps: true }
);

waitlistSchema.index({ vehicle: 1, status: 1, createdAt: 1 });

waitlistSchema.statics.STATUS = STATUS;

module.exports = mongoose.model('Waitlist', waitlistSchema);
