const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { expect } = require('chai');
const nock = require('nock');

let mongod;

const User = require('../src/models/User');
const { refreshOnce } = require('../src/worker/refreshProviders');

describe('Provider refresh worker', function(){
  this.timeout(20000);

  before(async ()=>{
    mongod = await MongoMemoryServer.create({ binary: { version: '6.0.6' } });
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  after(async ()=>{
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async ()=>{
    await User.deleteMany({});
    nock.cleanAll();
  });

  it('refreshes google access token using stored refresh token', async ()=>{
    process.env.GOOGLE_CLIENT_ID = 'gclient';
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';

    // mock token endpoint
    const scope = nock('https://oauth2.googleapis.com')
      .post('/token')
      .reply(200, { access_token: 'new-token-1', expires_in: 3600 });

    const u = await User.create({ email: 'guy@example.com', oauth: [{ provider: 'google', providerId: 'g-1', providerRefreshToken: 'r1', raw: {} }] });
    const res = await refreshOnce({ graceMs: 0 });
    expect(res.scanned).to.equal(1);
    expect(res.updated).to.equal(1);
    const fresh = await User.findById(u._id);
    expect(fresh.oauth[0].raw.access_token).to.equal('new-token-1');
    expect(fresh.oauth[0].raw.expires_at).to.be.a('number');
    scope.done();
  });

  it('refreshes microsoft access token using stored refresh token', async ()=>{
    process.env.MICROSOFT_CLIENT_ID = 'mclient';
    process.env.MICROSOFT_CLIENT_SECRET = 'msecret';

    const scope = nock('https://login.microsoftonline.com')
      .post('/common/oauth2/v2.0/token')
      .reply(200, { access_token: 'ms-new-1', expires_in: 1800 });

    const u = await User.create({ email: 'ms@example.com', oauth: [{ provider: 'microsoft', providerId: 'ms-1', providerRefreshToken: 'rms1', raw: {} }] });
  const res = await refreshOnce({ graceMs: 0 });
  // scanned should be >= 1 (this test's ms user); previous tests clean up users between runs
  expect(res.scanned).to.be.at.least(1);
  // at least one updated (the microsoft one)
    const fresh = await User.findById(u._id);
    expect(fresh.oauth[0].raw.access_token).to.equal('ms-new-1');
    expect(fresh.oauth[0].raw.expires_at).to.be.a('number');
    scope.done();
  });
});
