import express from "express";
import { prisma } from "./db/index.js"; // Import our singleton
import dotenv from "dotenv";
import v1Router from "./routes/v1.route.js";
dotenv.config();

const app = express();

//middlewares
app.use(express.json());

//routes
app.use("/api",v1Router);
app.get("/", async (req, res) => {
    res.status(200).json({msg:"Server Up and running"});
});

//listening
app.listen(3000, () => {
  console.log("Server listening on port 3000");
});