const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { expect } = require('chai');

const User = require('../src/models/User');
const Subscription = require('../src/models/Subscription');

let mongod;
let app;

describe('Stripe webhook handling', function(){
  this.timeout(20000);

  before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: '6.0.6' } });
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    app = express();
    // mount payment routes
    const payments = require('../src/routes/payments');
    // The webhook route expects express.raw when webhook signing is used; the router already
    // sets that up. For tests (no STRIPE_WEBHOOK_SECRET) we can post JSON normally.
    app.use('/api/payments', payments);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Subscription.deleteMany({});
  });

  it('handles checkout.session.completed and creates Subscription record', async () => {
    const user = await User.create({ email: 'pay@test.com', name: 'Pay Test' });

    // configure price map so price id maps to plan slug 'pro_monthly'
    process.env.STRIPE_PRICE_MAP = 'price_monthly_001:pro_monthly';

    const fakeSession = {
      id: 'sess_1',
      object: 'checkout.session',
      subscription: 'sub_123',
      customer: 'cus_456',
      metadata: { userId: String(user._id), priceId: 'price_monthly_001' }
    };

    const event = { type: 'checkout.session.completed', data: { object: fakeSession } };

  const res = await request(app).post('/api/payments/webhook').send(event).set('Accept', 'application/json');
  expect(res.status).to.equal(200);

    const sub = await Subscription.findOne({ user: user._id });
    expect(sub).to.exist;
    expect(sub.stripeSubscriptionId).to.equal('sub_123');
    expect(sub.stripeCustomerId).to.equal('cus_456');
    expect(sub.status).to.equal('active');
    // code maps Stripe price id -> internal plan slug via STRIPE_PRICE_MAP
    expect(sub.plan).to.equal('pro_monthly');
  });

  it('is idempotent: posting same event twice only processes once', async () => {
    const user = await User.create({ email: 'idem@test.com', name: 'Idem Test' });
    const fakeSession = {
      id: 'sess_idem',
      object: 'checkout.session',
      subscription: 'sub_idem',
      customer: 'cus_idem',
      metadata: { userId: String(user._id), priceId: 'price_xyz' }
    };
    const event = { id: 'evt_idem_1', type: 'checkout.session.completed', data: { object: fakeSession } };

    const r1 = await request(app).post('/api/payments/webhook').send(event).set('Accept', 'application/json');
    expect(r1.status).to.equal(200);
    expect(r1.body.received).to.equal(true);

    // Second post should be idempotent
    const r2 = await request(app).post('/api/payments/webhook').send(event).set('Accept', 'application/json');
    expect(r2.status).to.equal(200);
    expect(r2.body).to.have.property('idempotent', true);

    const subs = await Subscription.find({ user: user._id });
    expect(subs.length).to.equal(1);
  });

  it('updates subscription on customer.subscription.updated', async () => {
  const sub = await Subscription.create({ user: new mongoose.Types.ObjectId(), stripeSubscriptionId: 'sub_X', status: 'active' });

    const now = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // +30 days
    const ev = { type: 'customer.subscription.updated', data: { object: { id: 'sub_X', status: 'past_due', current_period_end: now } } };

    const res = await request(app).post('/api/payments/webhook').send(ev).set('Accept', 'application/json');
    expect(res.status).to.equal(200);

    const updated = await Subscription.findOne({ stripeSubscriptionId: 'sub_X' });
    expect(updated.status).to.equal('past_due');
    expect(updated.currentPeriodEnd).to.be.instanceOf(Date);
  });
});
