import type { Request, Response } from "express";
import { prisma } from "../db/index.js";

const combinedInsights = async (req:Request,res:Response) => {
    try{

    }catch(e){
        console.log("Error in combined Insights controller ");
        console.log("Incoming request : ",req);
        console.log("Error : ",e);
    }
}
const TenantOrders = (req:Request,res:Response) => {
    try{

    }catch(e){
        console.log("Error in combined Insights controller ");
        console.log("Incoming request : ",req);
        console.log("Error : ",e);
    }
}
const topCustomers = (req:Request,res:Response) => {
    try{

    }catch(e){
        console.log("Error in combined Insights controller ");
        console.log("Incoming request : ",req);
        console.log("Error : ",e);
    }
}
export {combinedInsights,TenantOrders,topCustomers};