import 'dotenv/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { runCustomerSegmentation } from '../scripts/run_ml_model.js';
import { mailQueue } from '../utils/redis.queue.js';
import { env } from '../utils/env.js';

const connection = new Redis(env("REDIS_URL"), { maxRetriesPerRequest: null });

const worker = new Worker(
    'analyticsQueue',
    async job => {
        console.log(`[Analytics] Processing job ${job.id}: ${job.name}`);

        if (job.name === 'generateInsights') {
            const { tenantId } = job.data;
            if (!tenantId) {
                console.error('[Analytics] Missing tenantId in job data');
                return;
            }

            console.log(`[Analytics] Triggering ML model for tenant: ${tenantId}`);
            try {
                await runCustomerSegmentation(tenantId);

                // Push to mail queue after successful ML analysis
                await mailQueue.add('sendAnalysisEmail', { tenantId });
                console.log(`[Analytics] Enqueued mail job for tenant: ${tenantId}`);
            } catch (error) {
                console.error(`[Analytics] Failed to run ML model for tenant ${tenantId}:`, error);
                throw error;
            }
        }
    },
    { connection },
);

worker.on('completed', job => {
    console.log(`[Analytics] Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`[Analytics] Job ${job?.id} failed with error: ${err.message}`);
});

console.log('[Analytics] Worker started and listening for jobs...');
