import { type Request, type Response } from 'express';
import { prisma } from '../db/index.js';
import { createShopifyClient } from '../utils/shopify.js';
import type { AuthRequest } from '../utils/interface.js';
import { syncReqQueue, redis } from "../utils/redis.queue.js";


const tenantVerification = async (tenantId: string, userId: string) => {
  try {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!tenant) return { auth: false, tenant: null };
    const auth = tenant.userId === userId;
    return { auth, tenant };

  } catch (e) {
    console.log("Error in tenant Verification helper function /controllers/datasync.controller.ts.tenantVerification(tenantId,userId)")
    return { auth: false, tenant: null };
  }
}



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

    // Initialize sync status tracker in Redis (3 categories: Products, Customers, Orders)
    await redis.set(`sync_status:${tenant.id}`, 3);

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