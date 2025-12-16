import type { Request, Response } from "express";
import { prisma } from "../db/index.js";
import sendMail from "../utils/sendgrid.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";

// Helper to generate a 6-digit numeric OTP
const generateOTP = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Validate Email
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailPattern.test(email)) {
      res.status(400).json({ msg: "Invalid or missing email" });
      return;
    }

    // --- DEVELOPMENT BYPASS: Instant login for specific test user ---
    if (email === "bharath@gmail.com") {
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({ data: { email } });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "15d" }
      );

      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "strict",
      });

      res.status(200).json({
        msg: "Login successful (dev bypass)",
        user: { id: user.id, email: user.email }
      });
      return; // Exit function after dev bypass
    }
    // --- END DEVELOPMENT BYPASS ---

    const otp = generateOTP();
    // Set expiration to 10 minutes from now
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Update or Create User with new OTP
    await prisma.user.upsert({
      where: { email },
      update: {
        otp,
        otpExpiresAt,
      },
      create: {
        email,
        otp,
        otpExpiresAt,
      },
    });

    // Send Email
    const sent = await sendMail(email, otp);

    if (sent === 1) {
      res.status(200).json({ msg: "OTP sent successfully. Check your email (and spam)." });
    } else {
      res.status(500).json({ msg: "Failed to send email." });
    }
  } catch (e) {
    console.error("Error in login:", e);
    res.status(500).json({ msg: "Internal Server Error" });
  }
};

export const verify = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ msg: "Missing email or OTP" });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({ msg: "User not found" });
      return;
    }

    // Check if OTP matches and is not expired
    if (!user.otp || user.otp !== otp) {
      res.status(400).json({ msg: "Invalid OTP" });
      return;
    }

    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      res.status(400).json({ msg: "OTP has expired" });
      return;
    }

    // Clear OTP after successful verification
    await prisma.user.update({
      where: { email },
      data: {
        otp: null,
        otpExpiresAt: null,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn:"15d"}
    );

    // Success
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
    });

    res.status(200).json({ 
      msg: "Login successful", 
      user: { id: user.id, email: user.email } 
    });

  } catch (e) {
    console.error("Error in verify:", e);
    res.status(500).json({ msg: "Internal Server Error" });
  }
};
