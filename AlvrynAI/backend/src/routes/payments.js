/* Payments routes (Stripe placeholders)
   - POST /create-checkout-session to start subscription flow
   - Webhooks endpoint placeholder to receive Stripe events
   - Use environment STRIPE_SECRET_KEY
*/

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_FAKE');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const StripeEvent = require('../models/StripeEvent');

// Helper: create or return a Stripe customer id for a user
async function ensureStripeCustomer(user) {
  if (!user) return null;
  // Try to read from Subscription collection first
  let sub = await Subscription.findOne({ user: user._id });
  if (sub && sub.stripeCustomerId) return sub.stripeCustomerId;
  // Otherwise create a customer in Stripe
  const customer = await stripe.customers.create({ email: user.email, metadata: { userId: String(user._id) } });
  if (!sub) {
    sub = new Subscription({ user: user._id, stripeCustomerId: customer.id });
  } else {
    sub.stripeCustomerId = customer.id;
  }
  await sub.save();
  return customer.id;
}

// Create a checkout session (placeholder: plan IDs should be created in Stripe)
// Require authentication to create a checkout session (user must be logged in)
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body;
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

    // Ensure Stripe customer exists for this user
    const customerId = await ensureStripeCustomer(req.user);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || (process.env.FRONTEND_URL || 'http://localhost:3000') + '/?checkout=success',
      cancel_url: cancelUrl || (process.env.FRONTEND_URL || 'http://localhost:3000') + '/?checkout=cancel',
      customer: customerId,
      metadata: { userId: String(req.user._id) }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session err', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Webhook endpoint for Stripe events (configure endpoint secret in env)
// Webhook endpoint for Stripe events. Configure STRIPE_WEBHOOK_SECRET in env.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event = null;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // If no webhook secret is configured (dev), parse the body directly.
      // Note: req.body may be a Buffer when express.raw was used; try to parse JSON.
      if (Buffer.isBuffer(req.body)) {
        try { event = JSON.parse(req.body.toString('utf8')); } catch (e) { event = null; }
      } else {
        event = req.body;
      }
    }
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event types we care about
  try {
    switch (event.type) {
      // Idempotency: ignore already-processed events
      default: {
        // continue to handler below
      }
    }
  } catch (err) {
    console.error('Error handling webhook event', err);
  }

  // Simple idempotency check: if the event has an id and we've already processed it, ignore.
  try {
    const eid = event && event.id;
    if (eid) {
      const exists = await StripeEvent.findOne({ eventId: eid });
      if (exists) {
        return res.json({ received: true, idempotent: true });
      }
    }
  } catch (ee) {
    console.warn('Could not check stripe event idempotency', ee.message);
  }

  // After passing idempotency check, handle event types below and then persist the event id

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // session.subscription contains the subscription id
        const stripeSubscriptionId = session.subscription;
        const stripeCustomerId = session.customer;
        const userId = session.metadata && session.metadata.userId;
        // Allow price/plan info to come via metadata in the session (safer in test/dev)
        const priceId = (session.metadata && (session.metadata.priceId || session.metadata.price)) || null;

        if (userId) {
          // Update or create our Subscription record
          let sub = await Subscription.findOne({ user: userId });
          if (!sub) sub = new Subscription({ user: userId });
          sub.stripeCustomerId = stripeCustomerId;
          sub.stripeSubscriptionId = stripeSubscriptionId;
          sub.status = 'active';
          // Set currentPeriodEnd by fetching subscription object if possible
          try {
            const remote = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            if (remote && remote.current_period_end) sub.currentPeriodEnd = new Date(remote.current_period_end * 1000);
          } catch (e) { console.warn('Could not fetch remote subscription', e.message); }
          if (priceId) sub.plan = priceId;
          await sub.save();

          // Update user subscription summary
          await User.findByIdAndUpdate(userId, { subscription: { plan: priceId || 'unknown', status: 'active', expiresAt: sub.currentPeriodEnd } });
        }
        break;
      }
      case 'invoice.paid': {
        // Optionally update subscription status on invoice paid
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const s = event.data.object;
        const stripeSubscriptionId = s.id;
        const sub = await Subscription.findOne({ stripeSubscriptionId });
        if (sub) {
          sub.status = s.status;
          if (s.current_period_end) sub.currentPeriodEnd = new Date(s.current_period_end * 1000);
          await sub.save();
          // update user record too
          await User.findByIdAndUpdate(sub.user, { subscription: { plan: sub.plan || 'unknown', status: sub.status, expiresAt: sub.currentPeriodEnd } });
        }
        break;
      }
      default:
        // Unhandled event
        break;
    }
  } catch (err) {
    console.error('Error handling webhook event', err);
  }

  // Persist processed event id for future idempotency checks
  try {
    if (event && event.id) {
      await StripeEvent.create({ eventId: event.id, type: event.type });
    }
  } catch (ee) {
    // ignore duplicate key errors etc
  }

  res.json({ received: true });
});

module.exports = router;
