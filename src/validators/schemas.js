'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const isoDate = z.string().datetime().or(z.coerce.date());

const inspectionItem = z.object({
  part: z.string().min(1),
  condition: z.enum(['ok', 'minor', 'damaged']).default('ok'),
  note: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

const auth = {
  register: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    phone: z.string().optional(),
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  refresh: z.object({ refreshToken: z.string().min(10) }),
};

const user = {
  submitLicense: z.object({
    number: z.string().min(3),
    expiresAt: isoDate,
  }),
  verifyLicense: z.object({
    status: z.enum(['verified', 'rejected']),
    rejectionReason: z.string().optional(),
  }),
};

const zone = {
  create: z.object({
    name: z.string().min(2),
    code: z.string().min(2),
    city: z.string().min(2),
    address: z.string().optional(),
    center: coord,
    radiusMeters: z.number().min(50).max(50000).default(500),
  }),
};

const vehicle = {
  create: z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int().min(1980),
    category: z.enum(['economy', 'compact', 'sedan', 'suv', 'luxury', 'van', 'electric']),
    fuelType: z.enum(['petrol', 'diesel', 'hybrid', 'electric']),
    transmission: z.enum(['manual', 'automatic']).default('automatic'),
    seats: z.number().int().min(1).max(60).default(5),
    color: z.string().optional(),
    licensePlate: z.string().min(1),
    vin: z.string().optional(),
    odometerKm: z.number().min(0).default(0),
    fuelCapacity: z.number().min(0).default(50),
    co2PerKm: z.number().min(0).optional(),
    basePricePerDay: z.number().min(0),
    homeZone: objectId,
    features: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
  }),
  update: z
    .object({
      basePricePerDay: z.number().min(0).optional(),
      status: z.enum(['available', 'rented', 'maintenance', 'retired']).optional(),
      odometerKm: z.number().min(0).optional(),
      fuelLevelPercent: z.number().min(0).max(100).optional(),
      features: z.array(z.string()).optional(),
      images: z.array(z.string()).optional(),
    })
    .refine((o) => Object.keys(o).length > 0, 'At least one field required'),
  search: z.object({
    startDate: isoDate,
    endDate: isoDate,
    category: z.string().optional(),
    zoneId: objectId.optional(),
    seats: z.coerce.number().optional(),
    fuelType: z.string().optional(),
  }),
};

const booking = {
  create: z.object({
    vehicleId: objectId,
    pickupZoneId: objectId.optional(),
    returnZoneId: objectId.optional(),
    startDate: isoDate,
    endDate: isoDate,
  }),
  confirm: z.object({
    method: z.enum(['card', 'wallet', 'cash', 'mock']).default('mock'),
  }),
  pickup: z.object({
    location: coord,
    odometerKm: z.number().min(0).optional(),
    fuelLevelPercent: z.number().min(0).max(100).optional(),
    items: z.array(inspectionItem).optional(),
  }),
  return: z.object({
    location: coord,
    odometerKm: z.number().min(0).optional(),
    fuelLevelPercent: z.number().min(0).max(100).optional(),
    items: z.array(inspectionItem).optional(),
    damageFee: z.number().min(0).optional(),
  }),
  cancel: z.object({ reason: z.string().optional() }),
  quote: z.object({
    vehicleId: objectId,
    startDate: isoDate,
    endDate: isoDate,
  }),
};

const waitlist = {
  join: z.object({
    vehicleId: objectId.optional(),
    category: z.string().optional(),
    zoneId: objectId.optional(),
    desiredStart: isoDate,
    desiredEnd: isoDate,
  }),
};

const review = {
  create: z.object({
    bookingId: objectId,
    rating: z.number().int().min(1).max(5),
    cleanliness: z.number().int().min(1).max(5).optional(),
    condition: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(2000).optional(),
  }),
};

const maintenance = {
  open: z.object({
    vehicleId: objectId,
    type: z.enum(['routine', 'repair', 'inspection', 'recall']).default('routine'),
    description: z.string().min(3),
    cost: z.number().min(0).optional(),
    odometerKm: z.number().min(0).optional(),
    performedBy: z.string().optional(),
    blocksAvailability: z.boolean().default(true),
  }),
  close: z.object({
    odometerKm: z.number().min(0).optional(),
    resetService: z.boolean().default(true),
  }),
};

module.exports = { auth, user, zone, vehicle, booking, waitlist, review, maintenance };
