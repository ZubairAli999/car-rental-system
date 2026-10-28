'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;

const ROLES = ['customer', 'staff', 'admin'];
const LICENSE_STATUS = ['none', 'pending', 'verified', 'rejected'];
const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    role: { type: String, enum: ROLES, default: 'customer', index: true },

    // Driver license verification workflow
    license: {
      number: { type: String, trim: true },
      expiresAt: { type: Date },
      status: { type: String, enum: LICENSE_STATUS, default: 'none' },
      verifiedAt: { type: Date },
      rejectionReason: { type: String },
    },

    // Loyalty programme
    loyalty: {
      points: { type: Number, default: 0, min: 0 },
      lifetimePoints: { type: Number, default: 0, min: 0 },
      tier: { type: String, enum: TIERS, default: 'bronze', index: true },
    },

    preferredCurrency: { type: String, default: 'USD', uppercase: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

/** A customer can only book when their license is verified and unexpired. */
userSchema.methods.canRent = function canRent() {
  if (this.license.status !== 'verified') return false;
  if (this.license.expiresAt && this.license.expiresAt < new Date()) return false;
  return true;
};

userSchema.statics.ROLES = ROLES;
userSchema.statics.TIERS = TIERS;

module.exports = mongoose.model('User', userSchema);
