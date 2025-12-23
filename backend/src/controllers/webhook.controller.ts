import type { Request, Response } from "express";
import { prisma } from "../db/index.js";

const syncWebhookData = async (req: Request, res: Response) => {
    try {
        const shopDomain = req.get("x-shopify-shop-domain");
        if (!shopDomain) {
            return res.status(400).json({ msg: "Missing shop domain header." });
        }

        const topic = req.get("x-shopify-topic");
        if (!topic) {
            return res.status(400).json({ msg: "Missing topic header." });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { shopName: shopDomain },
        });

        if (!tenant) {
            // If the tenant is not found, we cannot process the webhook.
            // This might happen if a shop uninstalls the app and we haven't processed the uninstall webhook yet.
            return res.status(404).json({ msg: "Tenant not found." });
        }

        switch (topic) {
            case "orders/create":
                await handleOrderCreate(req.body, tenant.id);
                break;
            // Add more cases here for other webhook topics like 'orders/updated', 'products/create', etc.
            default:
                console.log(`Unhandled webhook topic: ${topic}`);
        }

        res.status(200).send("ok");
    } catch (e) {
        console.log("Error in syncWebhookData controller:", e);
        res.status(500).json({ msg: "Internal Server Error" });
    }
};

async function handleOrderCreate(orderData: any, tenantId: string) {
    const { customer } = orderData;
    let customerId: string | undefined = undefined;

    if (customer) {
        const upsertedCustomer = await prisma.customer.upsert({
            where: { shopifyCustomerId: customer.id },
            update: {
                firstName: customer.first_name,
                lastName: customer.last_name,
                email: customer.email,
                totalSpent: customer.total_spent,
                ordersCount: customer.orders_count,
            },
            create: {
                id: customer.id.toString(),
                shopifyCustomerId: customer.id,
                firstName: customer.first_name,
                lastName: customer.last_name,
                email: customer.email,
                totalSpent: customer.total_spent,
                ordersCount: customer.orders_count,
                tenantId: tenantId,
            },
        });
        customerId = upsertedCustomer.id;
    }

    await prisma.order.create({
        data: {
            id: orderData.id.toString(),
            shopifyOrderId: orderData.id,
            orderNumber: orderData.order_number,
            totalPrice: orderData.total_price,
            currency: orderData.currency,
            createdAt: orderData.created_at,
            tenantId: tenantId,
            customerId: customerId,
        },
    });

    for (const item of orderData.line_items) {
        if(item.product_id) {
            await prisma.product.upsert({
                where: { shopifyProductId: item.product_id },
                update: {
                    title: item.title,
                    vendor: item.vendor,
                },
                create: {
                    id: item.product_id.toString(),
                    shopifyProductId: item.product_id,
                    title: item.title,
                    vendor: item.vendor,
                    tenantId: tenantId,
                    createdAt: new Date(),
                },
            });
        }
    }
}

export default syncWebhookData;
