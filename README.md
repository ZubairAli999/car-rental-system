# DriveNow — Car Rental System Backend

A production-shaped REST backend for a car rental business, built with **Node.js + Express + MongoDB (Mongoose)**. Beyond the usual CRUD, it ships a set of features most open-source rental backends don't have:

| # | Feature | Where |
|---|---------|-------|
| 1 | **Dynamic surge pricing engine** — price = base × demand × seasonality − lead-time − loyalty, with a fully transparent breakdown returned to the client | `services/pricingService.js` |
| 2 | **Carbon footprint & eco-score** — every booking estimates CO₂ from fuel type + distance, scores it 0–100, and suggests a greener available car | `services/carbonService.js` |
| 3 | **Loyalty tiers** — automatic points accrual, Bronze→Platinum tiers, each with a standing discount + points multiplier | `services/loyaltyService.js` |
| 4 | **Geofenced pickup/return zones** — Haversine validation that the car is picked up/dropped inside its virtual zone | `services/geofenceService.js` |
| 5 | **Waitlist with auto-notify + timed hold** — queue for a booked car; freed cars notify the front of the FIFO line | `services/waitlistService.js` |
| 6 | **Predictive maintenance** — cars past a mileage/calendar threshold are auto-flagged and pulled from availability by a nightly cron | `services/maintenanceService.js` |
| 7 | **Smart return inspection** — late-return + fuel-deficit penalty calc and a per-part damage checklist with photo refs | `services/bookingService.js` |
| 8 | **Admin analytics dashboard** — fleet utilisation, revenue, loyalty mix, and fleet-wide carbon in one call | `controllers/analyticsController.js` |

## Architecture

Layered: **routes → middleware (auth/validate) → controllers → services (business logic) → models**. Controllers stay thin; all domain rules live in services and are unit-testable in isolation.

```
src/
├── config/        env, db connection, logger
├── models/        Mongoose schemas (User, Vehicle, Zone, Booking, Payment, Review, MaintenanceLog, Waitlist)
├── services/      business logic — the "unique features" live here
├── controllers/   thin HTTP handlers
├── routes/        Express routers, one per resource
├── middleware/    auth, role guard, zod validation, error handler, rate limit
├── validators/    zod request schemas
├── jobs/          node-cron scheduled tasks
├── utils/         ApiError, asyncHandler, geo (haversine), dates, ids
├── seed/          database seeder
└── app.js         express app assembly
server.js          bootstrap: connect DB, start jobs, listen
```

## Getting started

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env        # then edit JWT_SECRET etc.

# 3. make sure MongoDB is running (local or Atlas URI in .env)

# 4. seed demo data (zones, fleet, users)
npm run seed

# 5. run
npm run dev                 # nodemon
# or
npm start
```

## Auth

JWT bearer tokens. `POST /auth/login` returns `accessToken` + `refreshToken`; send `Authorization: Bearer <accessToken>` on protected routes. Roles: `customer`, `staff`, `admin`.

## Key endpoints

### Auth
- `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me`

### Users & loyalty
- `POST /users/me/license` — submit license for verification
- `GET  /users/me/loyalty` — points, tier, perks, progress to next tier
- `PATCH /users/:id/license` *(staff/admin)* — verify/reject a license

### Zones
- `GET /zones` · `GET /zones/:id` · `POST /zones` *(admin)*

### Vehicles
- `GET /vehicles/search?startDate=&endDate=&category=&fuelType=&seats=` — availability search with eco-scores
- `GET /vehicles` · `GET /vehicles/:id` · `GET /vehicles/:vehicleId/reviews`
- `POST /vehicles` · `PATCH /vehicles/:id` *(staff/admin)* · `DELETE /vehicles/:id` *(admin, soft-retire)*

### Bookings (the core flow)
- `POST /bookings/quote` — dynamic price preview (no booking created)
- `POST /bookings` — create (status `pending`); returns pricing breakdown + carbon profile + greener-car suggestion
- `POST /bookings/:id/confirm` — charge payment → `confirmed`
- `POST /bookings/:id/pickup` *(staff)* — geofence-checked, records opening inspection → `active`
- `POST /bookings/:id/return` *(staff)* — geofence-checked, computes penalties + carbon, awards loyalty → `completed`
- `POST /bookings/:id/cancel` — tiered refund (>7d 100%, 2–7d 50%, <2d 0%)
- `GET /bookings` · `GET /bookings/:id`

### Waitlist
- `POST /waitlist` · `GET /waitlist` · `DELETE /waitlist/:id`

### Reviews
- `POST /reviews` — review a completed booking (recomputes vehicle rating)

### Maintenance *(staff/admin)*
- `GET /maintenance` · `GET /maintenance/due` · `POST /maintenance` · `POST /maintenance/:id/close` · `POST /maintenance/sweep` *(admin)*

### Analytics *(staff/admin)*
- `GET /analytics/dashboard`


## Scheduled jobs (`node-cron`)
- **02:00 daily** — predictive maintenance sweep (flag/pull due vehicles)
- **every 15 min** — expire stale waitlist holds
- **hourly** — mark no-shows (confirmed bookings 24h past start with no pickup)

## Notes for production
- The payment gateway (`services/paymentService.js`) is a mock that always approves — swap `charge`/`refund` for Stripe/PayPal; the rest of the system only depends on the `Payment` document.
- Pricing multipliers, tax, fees, and loyalty rates are all config-driven via `.env`.
- Swap the zero-dep logger for pino/winston without touching call sites.
- CO₂ intensities (`Vehicle.DEFAULT_CO2_PER_KM`) are well-to-wheel averages — localise per market.


