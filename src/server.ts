import express from "express";
import { prisma } from "./db/index.js"; // Import our singleton
import dotenv from "dotenv";
import v1Router from "./routes/v1.route.js";
import cookieParser from "cookie-parser";
import requestLogger from "./middleware/request.logger.middleware.js";

dotenv.config();

const app = express();

//middlewares
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
//routes
app.use("/api",v1Router);
app.get("/", async (req, res) => {
    res.status(200).json({msg:"Server Up and running"});
});

//listening
app.listen(process.env.PORT, () => {
  console.log("Server listening on port 3000");
});