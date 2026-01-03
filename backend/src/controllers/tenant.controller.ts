import { prisma } from "../db/index.js";
import type { Request, Response } from "express";
import type { AuthRequest } from "../utils/interface.js";


const getAllTenants = async (req: AuthRequest, res: Response) => {
    try {
        //user Id
        const { id, email } = req.user!;
        //fetch all tenant details from the tenants table 
        const tenants = await prisma.tenant.findMany({
            where: {
                userId: id
            }
        })
        res.status(200).json({
            tenants
        })
    } catch (e) {
        console.log("Error in  getAllTenants controller ");
        console.log("Incoming request : ", req);
        console.log("Error : ", e);
        res.status(500).json({
            msg: "Internal Server Error"
        })
    }
};
const addTenant = async (req: AuthRequest, res: Response) => {
    try {
        const { id, email } = req.user!;
        const { shopName, accessToken } = req.body;

        if (
            !shopName ||
            !accessToken ||
            typeof shopName !== 'string' ||
            typeof accessToken !== 'string'
        ) {
            res.status(400).json({
                msg: "Invalid input: shopName and accessToken must be non-empty strings"
            })
            return;
        }

        const tenant = await prisma.tenant.create({
            data: {
                shopName,
                accessToken,
                userId: id
            }
        })

        res.status(201).json({
            msg: "Tenant added successfully",
            tenant
        })

    } catch (e: any) {
        console.log("Error in  addTenant controller ");
        console.log("Incoming request : ", req);
        console.log("Error : ", e);

        if (e.code === 'P2002') {
            res.status(409).json({
                msg: "Tenant with this shop name already exists"
            });
            return;
        }

        res.status(500).json({
            msg: "Internal Server Error"
        })
    }
};
export { getAllTenants, addTenant };