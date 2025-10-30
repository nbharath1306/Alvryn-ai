const axios = require('axios');

const BASE = process.env.BASE_URL || 'http://localhost:4000';

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

async function waitForBackend(){
  for (let i=0;i<60;i++){
    try { await axios.get(BASE + '/'); return; } catch (e) { await wait(1000); }
  }
  throw new Error('Backend did not start in time');
}

async function signup(email, password, name){
  const res = await axios.post(BASE + '/api/auth/signup', { email, password, name });
  return res.data;
}

async function createContent(token, payload){
  const res = await axios.post(BASE + '/api/content', payload, { headers: { Authorization: 'Bearer ' + token } });
  return res.data.content;
}

async function enqueuePrediction(token, contentId){
  const res = await axios.post(BASE + '/api/ai/queue', { contentId }, { headers: { Authorization: 'Bearer ' + token } });
  return res.data.jobId;
}

async function getJob(token, jobId){
  const res = await axios.get(BASE + '/api/ai/queue/' + jobId, { headers: { Authorization: 'Bearer ' + token } });
  return res.data.job;
}

(async ()=>{
  try {
    console.log('Waiting for backend...');
    await waitForBackend();
    console.log('Backend up');

    const email = 'integ+' + Date.now() + '@example.com';
    const password = 'Password123!';

    console.log('Signing up test user', email);
    const s = await signup(email, password, 'Integration Test');
    const token = s.accessToken;
    console.log('Got token');

    console.log('Creating content');
    const content = await createContent(token, { platform: 'instagram', url: 'https://example.com/video', title: 'Integration test content' });
    console.log('Content created', content._id);

    console.log('Enqueueing prediction job');
    const jobId = await enqueuePrediction(token, content._id);
    console.log('Job id', jobId);

    // Poll job status
    let attempts = 0;
    while (attempts < 60){
      const job = await getJob(token, jobId);
      console.log('Job status', job.status);
      if (job.status === 'done'){
        console.log('Job done, result:', job.result);
        process.exit(0);
      }
      if (job.status === 'failed'){
        console.error('Job failed', job.lastError);
        process.exit(2);
      }
      attempts++;
      await wait(1000);
    }
    console.error('Job did not complete in time');
    process.exit(3);
  } catch (e) {
    console.error('Integration test error', e.message || e);
    process.exit(4);
  }
})();
