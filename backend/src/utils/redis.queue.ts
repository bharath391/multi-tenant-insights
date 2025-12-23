import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null }) 
  : new Redis({ maxRetriesPerRequest: null });

const syncReqQueue = new Queue('syncReqQueue', { 
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 5000     // Keep last 5000 failed jobs
  }
});

const syncDbQueue = new Queue('syncDbQueue', { 
  connection,
  defaultJobOptions: {
    attempts: 5, // More attempts for DB locks
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 5000
  } 
});

const analyticsQueue = new Queue('analyticsQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000, // ML jobs can be longer, give more backoff
    },
    removeOnComplete: true,
    removeOnFail: 500
  }
});

// async function addJobs() {
//   await myQueue.add('myJobName', { foo: 'bar' });
//   await myQueue.add('myJobName', { qux: 'baz' });
// }

// await addJobs();
export {syncDbQueue, syncReqQueue, analyticsQueue};