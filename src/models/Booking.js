'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const STATUS = [
  'pending', // created, awaiting payment/confirmation
  'confirmed', // paid, scheduled in the future
  'active', // vehicle picked up
  'completed', // vehicle returned & closed
  'cancelled',
  'no_show',
];

/** A single damage checklist item captured at pickup/return inspection. */
const inspectionItemSchema = new Schema(
  {
    part: { type: String, required: true }, // e.g. "front_bumper"
    condition: { type: String, enum: ['ok', 'minor', 'damaged'], default: 'ok' },
    note: { type: String },
    photoUrl: { type: String },
  },
  { _id: false }
);

const inspectionSchema = new Schema(
  {
    at: { type: Date },
    odometerKm: { type: Number },
    fuelLevelPercent: { type: Number, min: 0, max: 100 },
    location: { lat: Number, lng: Number },
    items: [inspectionItemSchema],
    inspectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const penaltySchema = new Schema(
  {
    type: { type: String, enum: ['late_return', 'fuel', 'damage', 'cleaning'] },
    description: { type: String },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },

    pickupZone: { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    returnZone: { type: Schema.Types.ObjectId, ref: 'Zone', required: true },

    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },

    status: { type: String, enum: STATUS, default: 'pending', index: true },

    // Transparent, audit-friendly pricing breakdown from the pricing engine
    pricing: {
      currency: { type: String, default: 'USD' },
      days: { type: Number },
      basePerDay: { type: Number },
      baseAmount: { type: Number },
      demandMultiplier: { type: Number, default: 1 },
      seasonalMultiplier: { type: Number, default: 1 },
      leadTimeDiscountRate: { type: Number, default: 0 },
      loyaltyDiscountRate: { type: Number, default: 0 },
      subtotal: { type: Number },
      insuranceFee: { type: Number, default: 0 },
      taxRate: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      totalAmount: { type: Number },
    },

    // Carbon / eco-score feature
    carbon: {
      estimatedKm: { type: Number, default: 0 },
      estimatedCo2Kg: { type: Number, default: 0 },
      actualKm: { type: Number, default: 0 },
      actualCo2Kg: { type: Number, default: 0 },
      ecoScore: { type: Number, min: 0, max: 100 }, // higher = greener
    },

    pickupInspection: inspectionSchema,
    returnInspection: inspectionSchema,

    penalties: [penaltySchema],
    penaltyTotal: { type: Number, default: 0 },

    loyaltyPointsEarned: { type: Number, default: 0 },

    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    cancellation: {
      at: { type: Date },
      reason: { type: String },
      refundAmount: { type: Number },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ vehicle: 1, startDate: 1, endDate: 1 });

/** Grand total the customer owes: rental total + any post-rental penalties. */
bookingSchema.methods.grandTotal = function grandTotal() {
  return (this.pricing.totalAmount || 0) + (this.penaltyTotal || 0);
};

bookingSchema.statics.STATUS = STATUS;
/** Statuses that occupy the vehicle and block overlapping bookings. */
bookingSchema.statics.BLOCKING_STATUSES = ['pending', 'confirmed', 'active'];

module.exports = mongoose.model('Booking', bookingSchema);
