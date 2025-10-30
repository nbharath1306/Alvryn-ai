/* Worker runner
   - Connects to MongoDB and starts the prediction worker
   - Run with: node src/worker/runWorker.js
*/

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alvryn';

async function main(){
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Worker connected to MongoDB');
    const { startWorker } = require('./predictWorker');
    startWorker(5000);
    console.log('Prediction worker started (separate process)');
  } catch (e) {
    console.error('Worker failed to start', e);
    process.exit(1);
  }
}

main();
