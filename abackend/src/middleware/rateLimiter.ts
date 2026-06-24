import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

const isProduction = process.env.NODE_ENV === "production";

const noop = (req: Request, _res: Response, next: NextFunction) => {
  if (req.method === "OPTIONS") {
    return next();
  }
  next();
};

/**
 * OTP requests — 5 per 15 minutes per mobile (production only).
 */
export const otpRateLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: "Too many OTP requests. Please try again after 15 minutes.",
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        if (req.body?.mobile) {
          return String(req.body.mobile);
        }
        return ipKeyGenerator(req.ip || "unknown");
      },
      skip: (req) => req.method === "OPTIONS",
    })
  : noop;

/**
 * Login attempts — 10 per 15 minutes per IP (production only).
 */
export const loginRateLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: "Too many login attempts. Please try again after 15 minutes.",
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.method === "OPTIONS",
    })
  : noop;

/**
 * General API — protects home/cart bursts from exhausting the Node process.
 */
export const apiRateLimiter = isProduction
  ? rateLimit({
      windowMs: 60 * 1000,
      max: 150,
      message: "Too many requests. Please slow down and try again shortly.",
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => ipKeyGenerator(req.ip || "unknown"),
      skip: (req) =>
        req.method === "OPTIONS" ||
        req.path.startsWith("/api/webhooks/"),
    })
  : noop;
