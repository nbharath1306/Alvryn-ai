const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { expect } = require('chai');
const nock = require('nock');

let mongod;
let app;
let server;

const User = require('../src/models/User');

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

describe('OAuth server-side flows (Google)', function(){
  this.timeout(20000);

  before(async ()=>{
    // ensure provider env vars exist for test-time so setupOAuth attaches routes
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-secret';
  process.env.MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || 'test-microsoft-client';
  process.env.MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || 'test-microsoft-secret';
  process.env.BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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
    nock.cleanAll();
  });

  beforeEach(async ()=>{
    await User.deleteMany({});
    nock.cleanAll();
  });

  it('google: sets oauth_state cookie, accepts callback, sets refresh cookie, and /api/auth/session returns access token', async ()=>{
    // env vars already set in before()

    // 1) initiate auth
    const init = await request(app).get('/api/auth/google');
    expect(init.status).to.be.oneOf([302,303]);
    const setCookies = init.headers['set-cookie'];
    expect(setCookies).to.exist;
    const oauthStateCookie = setCookies.find(c => c.startsWith('oauth_state='));
    expect(oauthStateCookie).to.exist;
    const match = oauthStateCookie.match(/oauth_state=([^;]+)/);
    expect(match).to.exist;
    const stateVal = match[1];
    // location should point to google accounts
    expect(init.headers.location).to.include('accounts.google.com');
    expect(init.headers.location).to.include(`state=${stateVal}`);

    // 2) mock token exchange and userinfo
    const googleTokenScope = nock('https://oauth2.googleapis.com')
      .post('/token')
      .reply(200, { access_token: 'fake-access-token', expires_in: 3600 });

    const googleUserinfoScope = nock('https://openidconnect.googleapis.com')
      .get('/v1/userinfo')
      .reply(200, { sub: 'google-sub-1', email: 'guy@example.com', name: 'G Guy', picture: 'https://example.com/av.png' });

    // 3) simulate callback with code and state, include oauth_state cookie
    const cb = await request(app).get(`/api/auth/google/callback?code=abc123&state=${stateVal}`).set('Cookie', `oauth_state=${stateVal}`);
    // should redirect to frontend oauth-callback
    expect(cb.status).to.be.oneOf([302,303]);
    expect(cb.headers.location).to.include('/oauth-callback');
    const cbCookies = cb.headers['set-cookie'];
    expect(cbCookies).to.exist;
    const refreshCookie = cbCookies.find(c => c.startsWith('refreshToken='));
    expect(refreshCookie).to.exist;

    // 4) call /api/auth/session with refresh cookie
    const sess = await request(app).get('/api/auth/session').set('Cookie', refreshCookie);
    expect(sess.status).to.equal(200);
    expect(sess.body).to.have.property('accessToken');
    expect(sess.body).to.have.property('user');
    expect(sess.body.user.email).to.equal('guy@example.com');
  });

  it('microsoft: sets oauth_state cookie, accepts callback, sets refresh cookie, and /api/auth/session returns access token', async ()=>{
    // Initiate microsoft auth
    const init = await request(app).get('/api/auth/microsoft');
    expect(init.status).to.be.oneOf([302,303]);
    const setCookies = init.headers['set-cookie'];
    expect(setCookies).to.exist;
    const oauthStateCookie = setCookies.find(c => c.startsWith('oauth_state='));
    expect(oauthStateCookie).to.exist;
    const match = oauthStateCookie.match(/oauth_state=([^;]+)/);
    expect(match).to.exist;
    const stateVal = match[1];
    expect(init.headers.location).to.include('login.microsoftonline.com');
    expect(init.headers.location).to.include(`state=${stateVal}`);

    // mock microsoft token endpoint
    const msTokenScope = nock('https://login.microsoftonline.com')
      .post('/common/oauth2/v2.0/token')
      .reply(200, { access_token: 'ms-fake-token', expires_in: 3600 });

    // mock userinfo
    const msUserScope = nock('https://graph.microsoft.com')
      .get('/oidc/userinfo')
      .reply(200, { sub: 'ms-sub-1', email: 'ms@example.com', name: 'M S', preferred_username: 'ms@example.com' });

    const cb = await request(app).get(`/api/auth/microsoft/callback?code=mscode123&state=${stateVal}`).set('Cookie', `oauth_state=${stateVal}`);
    expect(cb.status).to.be.oneOf([302,303]);
    expect(cb.headers.location).to.include('/oauth-callback');
    const cbCookies = cb.headers['set-cookie'];
    expect(cbCookies).to.exist;
    const refreshCookie = cbCookies.find(c => c.startsWith('refreshToken='));
    expect(refreshCookie).to.exist;

    const sess = await request(app).get('/api/auth/session').set('Cookie', refreshCookie);
    expect(sess.status).to.equal(200);
    expect(sess.body).to.have.property('accessToken');
    expect(sess.body).to.have.property('user');
    expect(sess.body.user.email).to.equal('ms@example.com');
  });
});
