import express from "express";
import { prisma } from "./db/index.js"; // Import our singleton
import dotenv from "dotenv";
import v1Router from "./routes/v1.route.js";
import cookieParser from "cookie-parser";
import requestLogger from "./middleware/request.logger.middleware.js";

dotenv.config();

const app = express();

//middlewares
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(cookieParser());
app.use(requestLogger);
//routes
app.use("/api/v1", v1Router);


//listening
app.listen(process.env.PORT, () => {
  console.log("Server listening on port 3000");
});