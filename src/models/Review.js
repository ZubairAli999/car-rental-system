'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    cleanliness: { type: Number, min: 1, max: 5 },
    condition: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
