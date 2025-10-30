const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { expect } = require('chai');

let mongod;
let app;
let server;

const User = require('../src/models/User');
const { signAccess } = require('../src/utils/jwt');

function buildApp(){
  const a = express();
  a.use(bodyParser.json());
  a.use(cookieParser());
  const authRoutes = require('../src/routes/auth');
  a.use('/api/auth', authRoutes);
  if (typeof authRoutes.setupOAuth === 'function') {
    authRoutes.setupOAuth(a);
  }
  return a;
}

describe('OAuth provider management', function(){
  this.timeout(20000);

  before(async ()=>{
    mongod = await MongoMemoryServer.create({ binary: { version: '6.0.6' } });
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    app = buildApp();
    server = app.listen(0);
  });

  after(async ()=>{
    await mongoose.disconnect();
    await mongod.stop();
    server && server.close();
  });

  beforeEach(async ()=>{
    await User.deleteMany({});
  });

  it('stores providerRefreshToken in oauth entry when present and supports listing & unlinking', async ()=>{
    // create user with an oauth entry
    const u = await User.create({ email: 'linkme@example.com', oauth: [{ provider: 'google', providerId: 'g-1', email: 'linkme@example.com', name: 'Link Me', providerRefreshToken: 'refresh-abc' }] });
    const token = signAccess(u);

    // list providers
    const resList = await request(app).get('/api/auth/providers').set('Authorization', `Bearer ${token}`);
    expect(resList.status).to.equal(200);
    expect(resList.body.providers).to.be.an('array');
    expect(resList.body.providers[0].provider).to.equal('google');

    // unlink provider
    const resUnlink = await request(app).post('/api/auth/providers/google/unlink').set('Authorization', `Bearer ${token}`);
    expect(resUnlink.status).to.equal(200);
    expect(resUnlink.body.removed).to.equal(1);

    // confirm none left
    const fresh = await User.findById(u._id);
    expect(fresh.oauth.length).to.equal(0);
  });
});
