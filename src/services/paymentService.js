'use strict';

const { Payment } = require('../models');
const { reference } = require('../utils/ids');

/**
 * Mock payment gateway. Swap `charge` with a Stripe/PayPal call in production;
 * the rest of the system only depends on the Payment document it returns.
 */
async function charge({ booking, user, amount, currency, method = 'mock' }) {
  const payment = await Payment.create({
    reference: reference('PAY'),
    booking: booking._id,
    user: user._id,
    amount,
    currency,
    method,
    status: 'succeeded', // mock gateway always approves
    gatewayRef: reference('GW'),
  });
  return payment;
}

/** Issue a (partial) refund against an existing payment. */
async function refund(payment, amount, reason = 'cancellation') {
  const alreadyRefunded = payment.refunds.reduce((s, r) => s + r.amount, 0);
  const refundable = payment.amount - alreadyRefunded;
  const refundAmount = Math.min(amount, refundable);
  if (refundAmount <= 0) return payment;

  payment.refunds.push({ amount: refundAmount, reason });
  const totalRefunded = alreadyRefunded + refundAmount;
  payment.status = totalRefunded >= payment.amount ? 'refunded' : 'partially_refunded';
  await payment.save();
  return payment;
}

module.exports = { charge, refund };
