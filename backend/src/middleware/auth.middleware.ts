import { type Request, type Response, type NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { type AuthRequest } from "../utils/interface.js";

const JWT_SECRET = process.env.JWT_SECRET!;

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies.token;

  if (!token) {
    res.status(401).json({ msg: "Access token missing" });
    return;
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as {id:string,email:string}; 
    req.user = user; 
    
    next();
  } catch (error) {
    res.status(403).json({ msg: "Invalid or Expired token - login again" });
    return;
  }
};