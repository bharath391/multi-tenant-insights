//sync queue data to database
import 'dotenv/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '../db/index.js';

const connection = new Redis({ maxRetriesPerRequest: null });

const worker = new Worker(
  'syncDbQueue',
  async job => {
    console.log(`[SyncDb] Processing job ${job.id}: ${job.name}`);
    
    try {
        if (job.name === 'processOrders') {
            const { tenantId, orders } = job.data;
            // ... (rest of logic) ...
            await prisma.$transaction(async (tx) => {
                for (const order of orders) {
                    // 1. Upsert Customer if exists
                    let customerId = null;
                    if (order.customer) {
                        const shopifyCustomerId = BigInt(order.customer.id.split('/').pop()); // Extract numeric ID
                        
                        const savedCustomer = await tx.customer.upsert({
                            where: { 
                                shopifyCustomerId: shopifyCustomerId 
                            },
                            update: {
                                totalSpent: order.customer.amountSpent?.amount || 0,
                                ordersCount: order.customer.numberOfOrders || 0,
                                firstName: order.customer.firstName,
                                lastName: order.customer.lastName,
                                email: order.customer.email,
                            },
                            create: {
                                shopifyCustomerId: shopifyCustomerId,
                                tenantId: tenantId,
                                firstName: order.customer.firstName,
                                lastName: order.customer.lastName,
                                email: order.customer.email,
                                totalSpent: order.customer.amountSpent?.amount || 0,
                                ordersCount: order.customer.numberOfOrders || 0,
                                id: crypto.randomUUID()
                            }
                        });
                        customerId = savedCustomer.id;
                    }

                    // 2. Upsert Order
                    const shopifyOrderId = BigInt(order.id.split('/').pop());
                    
                    await tx.order.upsert({
                        where: { shopifyOrderId: shopifyOrderId },
                        update: {
                            totalPrice: order.totalPriceSet?.shopMoney?.amount || 0,
                            currency: order.totalPriceSet?.shopMoney?.currencyCode || 'USD',
                            customerId: customerId
                        },
                        create: {
                            id: crypto.randomUUID(),
                            shopifyOrderId: shopifyOrderId,
                            orderNumber: parseInt(order.name.replace('#', '')) || 0, // Assuming name is like #1001
                            totalPrice: order.totalPriceSet?.shopMoney?.amount || 0,
                            currency: order.totalPriceSet?.shopMoney?.currencyCode || 'USD',
                            createdAt: new Date(order.createdAt),
                            tenantId: tenantId,
                            customerId: customerId
                        }
                    });
                }
            });
            console.log(`[SyncDb] Batch of ${orders.length} orders synced successfully.`);
        } 
        
        else if (job.name === 'processProducts') {
            const { tenantId, products } = job.data;
            await prisma.$transaction(async (tx) => {
                for (const product of products) {
                    const shopifyProductId = BigInt(product.id.split('/').pop());
                    await tx.product.upsert({
                        where: { shopifyProductId },
                        update: {
                            title: product.title,
                            bodyHtml: product.descriptionHtml,
                            vendor: product.vendor,
                            productType: product.productType
                        },
                        create: {
                            id: crypto.randomUUID(),
                            shopifyProductId,
                            tenantId,
                            title: product.title,
                            bodyHtml: product.descriptionHtml,
                            vendor: product.vendor,
                            productType: product.productType,
                            createdAt: new Date(product.createdAt)
                        }
                    });
                }
            });
            console.log(`[SyncDb] Batch of ${products.length} products synced successfully.`);
        }

        else if (job.name === 'processCustomers') {
            const { tenantId, customers } = job.data;
            await prisma.$transaction(async (tx) => {
                for (const customer of customers) {
                    const shopifyCustomerId = BigInt(customer.id.split('/').pop());
                    await tx.customer.upsert({
                        where: { shopifyCustomerId },
                        update: {
                            firstName: customer.firstName,
                            lastName: customer.lastName,
                            email: customer.email,
                            totalSpent: customer.amountSpent?.amount || 0,
                            ordersCount: customer.numberOfOrders || 0,
                        },
                        create: {
                            id: crypto.randomUUID(),
                            shopifyCustomerId,
                            tenantId,
                            firstName: customer.firstName,
                            lastName: customer.lastName,
                            email: customer.email,
                            totalSpent: customer.amountSpent?.amount || 0,
                            ordersCount: customer.numberOfOrders || 0,
                        }
                    });
                }
            });
            console.log(`[SyncDb] Batch of ${customers.length} customers synced successfully.`);
        }
    } catch (error: any) {
        console.error(`[SyncDb] Job ${job.id} failed:`, error);
        throw error; // Critical: throw error to trigger retry
    }
  },
  { connection },
);
