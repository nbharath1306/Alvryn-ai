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
const Prediction = require('../src/models/Prediction');
const { signAccess } = require('../src/utils/jwt');

// Helper to build app with routes (mounts api/ai routes)
function buildApp(){
  const a = express();
  a.use(bodyParser.json());
  // require routes after mongoose connection
  const aiRoutes = require('../src/routes/ai');
  a.use('/api/ai', aiRoutes);
  return a;
}

describe('AI routes (enqueue / list / cancel)', function(){
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
    await Content.deleteMany({});
    await Prediction.deleteMany({});
  });

  it('should allow enqueuing a job and listing it for owner, and cancelling works for owner but not for others', async ()=>{
    // create two users
    const u1 = await User.create({ email: 'alice@example.com' });
    const u2 = await User.create({ email: 'bob@example.com' });
    const token1 = signAccess(u1);
    const token2 = signAccess(u2);

    // create a content
    const c = await Content.create({ creator: u1._id, platform: 'other', url: 'https://example.com/video/1', title: 'Test' });

    // enqueue job as u1
    const resQ = await request(app).post('/api/ai/queue').set('Authorization', `Bearer ${token1}`).send({ contentId: c._id.toString(), title: 'Test job' });
    expect(resQ.statusCode).to.equal(200);
    expect(resQ.body.jobId).to.exist;
    const jobId = resQ.body.jobId;

    // list my jobs for u1
    const resList = await request(app).get('/api/ai/queue/my').set('Authorization', `Bearer ${token1}`);
    expect(resList.statusCode).to.equal(200);
    expect(resList.body.total).to.equal(1);
    expect(resList.body.jobs[0]._id).to.equal(jobId);

    // u2 cannot cancel u1's job
    const resCancelForbidden = await request(app).post(`/api/ai/queue/${jobId}/cancel`).set('Authorization', `Bearer ${token2}`).send();
    expect(resCancelForbidden.statusCode).to.equal(403);

    // u1 can cancel
    const resCancel = await request(app).post(`/api/ai/queue/${jobId}/cancel`).set('Authorization', `Bearer ${token1}`).send();
    expect([200,201]).to.include(resCancel.statusCode);
    expect(resCancel.body.job).to.exist;
    expect(resCancel.body.job.status).to.equal('cancelled');

    // subsequent cancel is idempotent-ish: returns 400 because not pending
    const resCancelAgain = await request(app).post(`/api/ai/queue/${jobId}/cancel`).set('Authorization', `Bearer ${token1}`).send();
    expect(resCancelAgain.statusCode).to.be.oneOf([400,200,404]);
  });
});
