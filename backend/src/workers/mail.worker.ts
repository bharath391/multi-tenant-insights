import 'dotenv/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '../db/index.js';
import { sendRetentionEmail, sendRewardEmail } from '../utils/sendgrid.js';
import { env } from '../utils/env.js';

const connection = new Redis(env("REDIS_URL"), { maxRetriesPerRequest: null });

const worker = new Worker(
    'mailQueue',
    async job => {
        console.log(`[Mail] Processing job ${job.id}: ${job.name}`);

        if (job.name === 'sendAnalysisEmail') {
            const { tenantId } = job.data;
            if (!tenantId) {
                console.error('[Mail] Missing tenantId in job data');
                return;
            }

            console.log(`[Mail] Fetching customers for tenant: ${tenantId}`);
            try {
                const tenant = await prisma.tenant.findUnique({
                    where: { id: tenantId },
                    select: { shopName: true }
                });

                if (!tenant) {
                    console.error(`[Mail] Tenant not found: ${tenantId}`);
                    return;
                }

                const customers = await prisma.customer.findMany({
                    where: { tenantId: tenantId }
                });

                console.log(`[Mail] Found ${customers.length} customers. Processing segments...`);

                let sentCount = 0;
                for (const customer of customers) {
                    if (!customer.email || !customer.segment) continue;

                    if (customer.segment === 'Champions' || customer.segment === 'Loyal Customers') {
                        const success = await sendRewardEmail(customer.email, tenant.shopName);
                        if (success) sentCount++;
                    } else if (customer.segment === 'At-Risk' || customer.segment === 'Lost') {
                        const success = await sendRetentionEmail(customer.email, tenant.shopName);
                        if (success) sentCount++;
                    }
                }

                console.log(`[Mail] Processed segments. Sent ${sentCount} emails for tenant ${tenantId}.`);

            } catch (error) {
                console.error(`[Mail] Failed to process mail job for tenant ${tenantId}:`, error);
                throw error;
            }
        }
    },
    { connection },
);

worker.on('completed', job => {
    console.log(`[Mail] Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`[Mail] Job ${job?.id} failed with error: ${err.message}`);
});

console.log('[Mail] Worker started and listening for jobs...');
