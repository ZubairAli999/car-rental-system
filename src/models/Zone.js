'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * A geofenced pickup/return area. Vehicles live in a zone, and pickups/returns
 * are only valid when the reported coordinates fall inside the circle.
 */
const zoneSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    center: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    radiusMeters: { type: Number, required: true, min: 50, default: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Zone', zoneSchema);
