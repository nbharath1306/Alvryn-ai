const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { expect } = require('chai');

let mongod;
let app;
let server;

const User = require('../src/models/User');
const Content = require('../src/models/Content');
const Engagement = require('../src/models/Engagement');
const Prediction = require('../src/models/Prediction');
const { signAccess } = require('../src/utils/jwt');

function buildApp(){
  const a = express();
  a.use(bodyParser.json());
  const gdpr = require('../src/routes/gdpr');
  a.use('/api/gdpr', gdpr);
  return a;
}

describe('GDPR endpoints', function(){
  this.timeout(20000);

  before(async ()=>{
    mongod = await MongoMemoryServer.create();
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
    await Content.deleteMany({});
    await Engagement.deleteMany({});
    await Prediction.deleteMany({});
  });

  it('exports and deletes user data', async ()=>{
    const u = await User.create({ email: 'gdpr@example.com', name: 'GDPR User' });
    const token = signAccess(u);
    // create content
    const c = await Content.create({ creator: u._id, platform: 'other', url: 'https://example.com/1', title: 'My vid' });
    // engagement
    await Engagement.create({ user: u._id, content: c._id, platform: 'other', watchSeconds: 30, liked: true, commented: false, valid: true });
    // prediction
    await Prediction.create({ enqueuedBy: u._id, input: { title: 'p' }, status: 'pending' });

    // export
    const res = await request(app).get('/api/gdpr/export').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(res.body.data).to.exist;
    expect(res.body.data.contents).to.have.lengthOf(1);
    expect(res.body.data.engagements).to.have.lengthOf(1);
    expect(res.body.data.predictions).to.have.lengthOf(1);

    // delete (anonymize)
    const del = await request(app).delete('/api/gdpr/delete').set('Authorization', `Bearer ${token}`);
    expect(del.statusCode).to.equal(200);
    expect(del.body.ok).to.equal(true);

    // verify user anonymized
    const uu = await User.findById(u._id).lean();
    expect(uu.email).to.match(/^deleted_/);
    expect(uu.name).to.equal('Deleted User');

    // verify engagements removed
    const engs = await Engagement.find({ user: u._id });
    expect(engs.length).to.equal(0);
    // predictions removed
    const preds = await Prediction.find({ enqueuedBy: u._id });
    expect(preds.length).to.equal(0);
    // content anonymized (creator null)
    const content = await Content.findById(c._id).lean();
    expect(content.creator).to.equal(null);
  });
});
