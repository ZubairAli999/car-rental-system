'use strict';

/**
 * Seed the database with zones, a fleet, and demo users.
 * Usage: npm run seed   (wipes the collections it manages, then inserts)
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Zone, Vehicle } = require('../models');
const logger = require('../config/logger');

const DAY = 24 * 60 * 60 * 1000;

async function seed() {
  await connectDB();
  logger.info('[seed] Clearing managed collections...');
  await Promise.all([User.deleteMany({}), Zone.deleteMany({}), Vehicle.deleteMany({})]);

  // --- Zones -------------------------------------------------------------
  const zones = await Zone.create([
    {
      name: 'Downtown Hub',
      code: 'DT',
      city: 'Metropolis',
      address: '1 Market St',
      center: { lat: 40.7128, lng: -74.006 },
      radiusMeters: 800,
    },
    {
      name: 'Airport Terminal',
      code: 'APT',
      city: 'Metropolis',
      address: 'Intl Airport, Arrivals',
      center: { lat: 40.6413, lng: -73.7781 },
      radiusMeters: 1200,
    },
  ]);
  logger.info(`[seed] Created ${zones.length} zones`);

  // --- Users -------------------------------------------------------------
  const admin = new User({ name: 'Ada Admin', email: 'admin@drivenow.test', role: 'admin' });
  await admin.setPassword('Password123!');

  const staff = new User({ name: 'Sam Staff', email: 'staff@drivenow.test', role: 'staff' });
  await staff.setPassword('Password123!');

  const customer = new User({
    name: 'Cleo Customer',
    email: 'customer@drivenow.test',
    role: 'customer',
    license: {
      number: 'DL-99887766',
      expiresAt: new Date(Date.now() + 365 * DAY),
      status: 'verified',
      verifiedAt: new Date(),
    },
    loyalty: { points: 1500, lifetimePoints: 1500, tier: 'silver' },
  });
  await customer.setPassword('Password123!');

  await User.insertMany([admin, staff, customer]);
  logger.info('[seed] Created admin / staff / customer (password: Password123!)');

  // --- Vehicles ----------------------------------------------------------
  const fleet = [
    { make: 'Toyota', model: 'Corolla', year: 2023, category: 'economy', fuelType: 'petrol', basePricePerDay: 42, licensePlate: 'ECO-101', seats: 5 },
    { make: 'Honda', model: 'Civic', year: 2022, category: 'compact', fuelType: 'hybrid', basePricePerDay: 55, licensePlate: 'CMP-202', seats: 5 },
    { make: 'Tesla', model: 'Model 3', year: 2024, category: 'electric', fuelType: 'electric', basePricePerDay: 89, licensePlate: 'EV-303', seats: 5, features: ['autopilot', 'fast-charge'] },
    { make: 'BMW', model: 'X5', year: 2023, category: 'suv', fuelType: 'diesel', basePricePerDay: 120, licensePlate: 'SUV-404', seats: 7 },
    { make: 'Mercedes', model: 'S-Class', year: 2024, category: 'luxury', fuelType: 'petrol', basePricePerDay: 210, licensePlate: 'LUX-505', seats: 5, features: ['massage-seats', 'chauffeur-mode'] },
    { make: 'Ford', model: 'Transit', year: 2021, category: 'van', fuelType: 'diesel', basePricePerDay: 95, licensePlate: 'VAN-606', seats: 12 },
  ];

  const created = await Vehicle.insertMany(
    fleet.map((v, i) => ({
      ...v,
      homeZone: zones[i % zones.length]._id,
      odometerKm: 12000 + i * 3000,
      maintenance: { serviceIntervalKm: 15000, lastServiceOdometerKm: 10000 },
      currentLocation: zones[i % zones.length].center,
    }))
  );
  logger.info(`[seed] Created ${created.length} vehicles`);

  logger.info('[seed] Done.');
  await disconnectDB();
  await mongoose.connection.close();
}

seed().catch(async (err) => {
  logger.error('[seed] Failed:', err.message);
  process.exit(1);
});
