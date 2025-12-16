//work on incoming sync/products | customers | orders requests
import 'dotenv/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createShopifyClient } from '../utils/shopify.js';
import { syncDbQueue } from '../utils/redis.queue.js';
import { prisma } from '../db/index.js';

const connection = new Redis({ maxRetriesPerRequest: null });

const worker = new Worker(
  'syncReqQueue',
  async job => {
    console.log(`[SyncReq] Processing job ${job.id}: ${job.name}`);
    const { tenantId, shopName, accessToken } = job.data;

    try {
      const client = createShopifyClient(shopName, accessToken);
      let cursor: string | null = null;
      let hasNextPage = true;

      // --- Sync Orders ---
      if (job.name === 'syncOrders') {
        while (hasNextPage) {
          const query = `
            query getOrders($cursor: String) {
              orders(first: 10, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                edges {
                  node {
                    id
                    name
                    createdAt
                    totalPriceSet { shopMoney { amount currencyCode } }
                    # customer field removed to avoid PII access errors (requires advanced permissions)
                    # customer {
                    #   id
                    #   firstName
                    #   lastName
                    #   email
                    #   amountSpent { amount }
                    #   numberOfOrders
                    # }
                  }
                }
              }
            }
          `;
          const response: any = await client.request(query, { variables: { cursor } });
          const orders = response.data.orders.edges.map((edge: any) => edge.node);
          
          if (orders.length > 0) {
              await syncDbQueue.add('processOrders', { tenantId, orders });
          }
          hasNextPage = response.data.orders.pageInfo.hasNextPage;
          cursor = response.data.orders.pageInfo.endCursor;
        }
      }

      // --- Sync Products ---
      else if (job.name === 'syncProducts') {
        while (hasNextPage) {
          const query = `
            query getProducts($cursor: String) {
              products(first: 10, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                edges {
                  node {
                    id
                    title
                    descriptionHtml
                    vendor
                    productType
                    createdAt
                  }
                }
              }
            }
          `;
          const response: any = await client.request(query, { variables: { cursor } });
          const products = response.data.products.edges.map((edge: any) => edge.node);

          if (products.length > 0) {
              await syncDbQueue.add('processProducts', { tenantId, products });
          }
          hasNextPage = response.data.products.pageInfo.hasNextPage;
          cursor = response.data.products.pageInfo.endCursor;
        }
      }

      // --- Sync Customers ---
      else if (job.name === 'syncCustomers') {
        try {
            while (hasNextPage) {
              const query = `
                query getCustomers($cursor: String) {
                  customers(first: 10, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    edges {
                      node {
                        id
                        firstName
                        lastName
                        email
                        amountSpent { amount }
                        numberOfOrders
                      }
                    }
                  }
                }
              `;
              const response: any = await client.request(query, { variables: { cursor } });
              const customers = response.data.customers.edges.map((edge: any) => edge.node);

              if (customers.length > 0) {
                  await syncDbQueue.add('processCustomers', { tenantId, customers });
              }
              hasNextPage = response.data.customers.pageInfo.hasNextPage;
              cursor = response.data.customers.pageInfo.endCursor;
            }
        } catch (error: any) {
             if (error.message && (error.message.includes('access the Customer object') || error.message.includes('GraphqlQueryError'))) {
                 console.warn(`[SyncReq] Skipping syncCustomers for ${shopName}: PII Access Denied.`);
                 return; 
             }
             throw error;
        }
      }

    } catch (error: any) {
      console.error(`[SyncReq] Job ${job.id} failed:`, error);
      throw error; // Rethrow to mark job as failed
    }
  },
  { connection },
);


worker.on('completed', async job => {
  console.log(`[SyncReq] Job ${job.id} completed!`);
  // Update tenant isSyncing status to false
  try {
      const { tenantId } = job.data;
      await prisma.tenant.update({
          where: { id: tenantId },
          data: { isSyncing: false, lastSync: new Date() }
      });
  } catch (e) {
      console.error("Failed to update tenant sync status", e);
  }
});

worker.on('failed', async (job, err) => {
  console.log(`[SyncReq] Job ${job?.id} has failed with ${err.message}`);
    // Update tenant isSyncing status to false on failure too
    try {
        if(job?.data?.tenantId){
            await prisma.tenant.update({
                where: { id: job.data.tenantId },
                data: { isSyncing: false }
            });
        }
    } catch (e) {
        console.error("Failed to update tenant sync status on failure", e);
    }
});

