'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const TYPES = ['routine', 'repair', 'inspection', 'recall'];

const maintenanceLogSchema = new Schema(
  {
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    type: { type: String, enum: TYPES, default: 'routine' },
    description: { type: String, required: true },
    odometerKm: { type: Number },
    cost: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    performedBy: { type: String },
    // While open & blocking, the vehicle is held in "maintenance" status.
    blocksAvailability: { type: Boolean, default: true },
    isOpen: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

maintenanceLogSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('MaintenanceLog', maintenanceLogSchema);
