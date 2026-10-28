'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const STATUS = ['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'];
const METHODS = ['card', 'wallet', 'cash', 'mock'];

const paymentSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    method: { type: String, enum: METHODS, default: 'mock' },
    status: { type: String, enum: STATUS, default: 'pending', index: true },

    gatewayRef: { type: String }, // id returned by the payment provider
    refunds: [
      {
        amount: Number,
        reason: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

paymentSchema.statics.STATUS = STATUS;
paymentSchema.statics.METHODS = METHODS;

module.exports = mongoose.model('Payment', paymentSchema);
