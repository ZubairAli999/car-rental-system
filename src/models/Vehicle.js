'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const CATEGORIES = ['economy', 'compact', 'sedan', 'suv', 'luxury', 'van', 'electric'];
const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric'];
const TRANSMISSIONS = ['manual', 'automatic'];
const STATUS = ['available', 'rented', 'maintenance', 'retired'];

/**
 * Default grams of CO2 per km by fuel type (well-to-wheel averages).
 * Electric uses a grid-mix estimate; a real deployment would localise this.
 */
const DEFAULT_CO2_PER_KM = {
  petrol: 192,
  diesel: 171,
  hybrid: 110,
  electric: 53,
};

const vehicleSchema = new Schema(
  {
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1980 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    fuelType: { type: String, enum: FUEL_TYPES, required: true },
    transmission: { type: String, enum: TRANSMISSIONS, default: 'automatic' },
    seats: { type: Number, default: 5, min: 1 },
    color: { type: String, trim: true },

    licensePlate: { type: String, required: true, unique: true, uppercase: true, trim: true },
    vin: { type: String, unique: true, sparse: true, uppercase: true, trim: true },

    // Odometer & fuel/charge state
    odometerKm: { type: Number, default: 0, min: 0 },
    fuelCapacity: { type: Number, default: 50 }, // litres or kWh
    fuelLevelPercent: { type: Number, default: 100, min: 0, max: 100 },

    // Emissions — drives the eco-score feature
    co2PerKm: {
      type: Number,
      default: function co2Default() {
        return DEFAULT_CO2_PER_KM[this.fuelType] ?? 180;
      },
    },

    // Pricing
    basePricePerDay: { type: Number, required: true, min: 0 },

    // Location / geofencing
    homeZone: { type: Schema.Types.ObjectId, ref: 'Zone', required: true, index: true },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },

    status: { type: String, enum: STATUS, default: 'available', index: true },

    // Predictive maintenance thresholds
    maintenance: {
      serviceIntervalKm: { type: Number, default: 15000 },
      lastServiceOdometerKm: { type: Number, default: 0 },
      lastServiceDate: { type: Date },
      nextServiceDate: { type: Date },
      serviceDueFlag: { type: Boolean, default: false, index: true },
    },

    features: [{ type: String, trim: true }],
    images: [{ type: String }],

    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ category: 1, status: 1 });

/** Km driven since the last service — used by the maintenance predictor. */
vehicleSchema.methods.kmSinceService = function kmSinceService() {
  return this.odometerKm - (this.maintenance.lastServiceOdometerKm || 0);
};

/** True if the car has hit its mileage or calendar service threshold. */
vehicleSchema.methods.isServiceDue = function isServiceDue(now = new Date()) {
  const byMileage = this.kmSinceService() >= this.maintenance.serviceIntervalKm;
  const byDate =
    this.maintenance.nextServiceDate && this.maintenance.nextServiceDate <= now;
  return Boolean(byMileage || byDate);
};

vehicleSchema.statics.CATEGORIES = CATEGORIES;
vehicleSchema.statics.FUEL_TYPES = FUEL_TYPES;
vehicleSchema.statics.STATUS = STATUS;
vehicleSchema.statics.DEFAULT_CO2_PER_KM = DEFAULT_CO2_PER_KM;

module.exports = mongoose.model('Vehicle', vehicleSchema);
