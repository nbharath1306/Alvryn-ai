const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { expect } = require('chai');

let mongod;

describe('Prediction worker backoff & retries', function(){
  this.timeout(20000);
  let Prediction;
  let worker;

  before(async ()=>{
    // set small limits for test
    process.env.WORKER_MAX_ATTEMPTS = '2';
    process.env.WORKER_BASE_BACKOFF_SEC = '0';
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    Prediction = require('../src/models/Prediction');
    worker = require('../src/worker/predictWorker');
  });

  after(async ()=>{
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async ()=>{
    await Prediction.deleteMany({});
  });

  it('schedules retry on failure and marks failed after max attempts', async ()=>{
    // create job
    const job = new Prediction({ input: { title: 'fail-test' } });
    await job.save();

    // stub runPython to always fail
    const original = worker.runPython;
    worker.runPython = async ()=>({ code: 1, out: '', err: 'simulated error' });

    // call processOne twice: first should set nextRunAt and attempts=1, second should mark failed
    await worker.processOne();
    let j1 = await Prediction.findById(job._id).lean();
    expect(j1.attempts).to.equal(1);
    expect(j1.status).to.equal('pending');
    expect(j1.nextRunAt).to.exist;

    // fast-forward: clear nextRunAt so next call can pick it (simulate time passing)
    await Prediction.findByIdAndUpdate(job._id, { $set: { nextRunAt: new Date(Date.now() - 1000) } });

    await worker.processOne();
    let j2 = await Prediction.findById(job._id).lean();
    expect(j2.attempts).to.equal(2);
    expect(j2.status).to.equal('failed');

    // restore
    worker.runPython = original;
  });

  it('marks done when python returns success', async ()=>{
    const job = new Prediction({ input: { title: 'ok-test' } });
    await job.save();

    const original = worker.runPython;
    worker.runPython = async ()=>({ code: 0, out: JSON.stringify({ score: 0.9 }), err: '' });

    await worker.processOne();
    const j = await Prediction.findById(job._id).lean();
    expect(j.status).to.equal('done');
    expect(j.result).to.exist;
    expect(j.result.score).to.equal(0.9);

    worker.runPython = original;
  });
});
