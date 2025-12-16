import {type Request, type Response } from 'express';
import { prisma } from '../db/index.js';
import { createShopifyClient } from '../utils/shopify.js';
import type { AuthRequest } from '../utils/interface.js';
import {syncReqQueue} from "../utils/redis.queue.js";


const tenantVerification = async (tenantId:string,userId:string) => {
  try{
    const tenant = await prisma.tenant.findFirst({where:{id:tenantId}});
    if (!tenant) return { auth: false, tenant: null };
    const auth = tenant.userId === userId;
    return {auth,tenant};

  }catch(e){
    console.log("Error in tenant Verification helper function /controllers/datasync.controller.ts.tenantVerification(tenantId,userId)")
    return { auth: false, tenant: null };
  }
}

export const testShopifyConnection = async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId; // Assuming tenantId is passed in URL
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required.' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    if (!tenant.shopName || !tenant.accessToken) {
      return res.status(400).json({ error: 'Tenant record missing shopName or accessToken.' });
    }

    const client = createShopifyClient(tenant.shopName, tenant.accessToken);

    const productsQuery = `
      query getProducts {
        products(first: 5) {
          edges {
            node {
              id
              title
              status
            }
          }
        }
      }
    `;

    const response = await client.request(productsQuery);

    // Check for errors in the Shopify response
    if (response.data.products.edges.length === 0) {
      return res.status(200).json({
        message: `Successfully connected to Shopify for ${tenant.shopName}, but no products found or query returned empty.`,
        data: response.data,
      });
    }


    res.status(200).json({
      message: `Successfully fetched products from ${tenant.shopName}.`,
      products: response.data.products.edges.map((edge: any) => edge.node),
      fullShopifyResponse: response // For full inspection
    });

  } catch (error: any) {
    console.error('Shopify connection test failed:', error);
    res.status(500).json({
      error: 'Failed to connect to Shopify or fetch data.',
      details: error.message,
    });
  }
};

export const TenantDataSync = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = req.params;
        const userId = req.user!.id;

        if (!tenantId) {
            res.status(401).json({ msg: "Missing Tenant Id" });
            return;
        }

        const { auth, tenant } = await tenantVerification(tenantId, userId);
        if (!auth || !tenant) {
            res.status(401).json({ msg: "Unauthorized or Tenant not found" });
            return;
        }

        if (tenant.isSyncing) {
            res.status(208).json({ msg: "Is already under sync, please wait for some time" });
            return;
        }

        // Update isSyncing status
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: { isSyncing: true }
        });

        // Trigger parallel sync jobs
        const jobData = {
            tenantId: tenant.id,
            shopName: tenant.shopName,
            accessToken: tenant.accessToken
        };

        await Promise.all([
            syncReqQueue.add("syncProducts", jobData),
            syncReqQueue.add("syncCustomers", jobData),
            syncReqQueue.add("syncOrders", jobData)
        ]);

        res.status(200).json({ msg: "Sync started..." });
        return;

    } catch (e) {
        console.log("Error in TenantDataSync controller");
        console.log("Incoming request : ", req);
        console.log("Error : ", e);
        res.status(500).json({ msg: "Internal Server Error" });
    }
}