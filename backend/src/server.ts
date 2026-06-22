
import dns from "dns";
import path from "path";
import { ensureEnvLoaded, getEnvLoadedFrom } from "./config/env";

// Load environment variables as early as possible
ensureEnvLoaded();

console.log('--- SERVER STARTING ---');
const envFrom = getEnvLoadedFrom();
if (envFrom && process.env.NODE_ENV !== "production") {
  console.log("Env file:", path.relative(process.cwd(), envFrom));
}
console.log('RAZORPAY_KEY_ID exists:', !!process.env.RAZORPAY_KEY_ID);

// Custom DNS resolvers help on some dev networks but can break on shared hosts
// that restrict outbound DNS to the provider's resolvers.
if (hostingDefaults.useCustomDnsServers) {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
}

import express, { Application, Request, Response } from "express";
import { createServer } from "http";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import connectDB from "./config/db";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { ensureDefaultAdmin } from "./utils/ensureDefaultAdmin";
import { seedHeaderCategories } from "./utils/seedHeaderCategories";
import { initializeSocket } from "./socket/socketService";
import razorpayWebhookRoutes from "./webhooks/razorpay/razorpayWebhookRoutes";
import { UPLOAD_DIR, ensureUploadDir } from "./config/storage";
import { logger } from "./utils/logger";
import { hostingDefaults, isSharedHosting } from "./config/hosting";
import { corsOptions, applyCorsHeaders } from "./config/cors";

// ---------------------------------------------------------------------------
// Global crash guards.
//
// Without these, a single unhandled promise rejection or uncaught exception
// anywhere (including async socket/event handlers) terminates the entire Node
// process for ALL connected users. We log the error and keep the process alive;
// the request/socket that triggered it fails in isolation instead of taking
// down the server. A fatal, unrecoverable state still results in a controlled
// shutdown via the handler below.
// ---------------------------------------------------------------------------
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const app: Application = express();
const httpServer = createServer(app);

// Required so express-rate-limit and secure cookies read the real client IP
// when running behind a reverse proxy (Nginx / Hostinger / Render).
app.set("trust proxy", 1);

// CORS must be first so OPTIONS preflight and error responses include headers.
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Gzip in-app only when the edge proxy is not already compressing (Hostinger
// LiteSpeed usually is). Saves CPU on a single shared-hosting core.
if (hostingDefaults.useCompression) {
  app.use(compression());
}

// Ensure persistent upload directory exists (outside nodejs/ on Hostinger)
ensureUploadDir();

// Serve uploaded files at https://api.wasgromart.com/uploads/...
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: "7d",
    setHeaders: (res) => {
      res.set("Cache-Control", "public, max-age=604800");
    },
  })
);

// Capture raw body for Razorpay webhook signature verification without changing existing routes.
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      if (
        req?.originalUrl?.includes("/payment/webhook") ||
        req?.originalUrl?.includes("/api/webhooks/razorpay")
      ) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Dedicated webhook endpoint (source of truth for payment/subscription state).
// Mounted outside /api/v1 to match: POST /api/webhooks/razorpay
// Must be registered AFTER the JSON middleware so rawBody capture works.
app.use("/api/webhooks/razorpay", razorpayWebhookRoutes);

// Initialize Socket.io
const io = initializeSocket(httpServer);
app.set("io", io);

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({
    service: "wasgro-backend-api",
    message: "Kosil API Server is running!",
    version: "1.0.0",
    socketIO: "Listening for WebSocket connections",
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "wasgro-backend-api" });
});

app.get("/debug-sockets", (req: Request, res: Response) => {
  // Never expose live socket state on a public shared host without a secret key.
  const debugKey = process.env.DEBUG_ENDPOINT_KEY;
  if (process.env.NODE_ENV === "production") {
    if (!debugKey || req.query.key !== debugKey) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
  }

  try {
    const io = req.app.get("io");
    if (!io) {
      return res.status(500).json({ error: "Socket.io server not initialized" });
    }

    // Import dynamically to avoid circular dependencies
    const { notificationStates } = require("./services/orderNotificationService");

    const sockets = Array.from(io.sockets.sockets.values()).map((s: any) => ({
      id: s.id,
      userId: s.user?.userId,
      userType: s.user?.userType,
      rooms: Array.from(s.rooms),
    }));

    const allRooms: any = {};
    for (const [room, members] of io.sockets.adapter.rooms.entries()) {
      allRooms[room] = {
        size: members.size,
        sockets: Array.from(members),
      };
    }

    const activeNotifications = Array.from(notificationStates.entries()).map(([orderId, state]: [string, any]) => ({
      orderId,
      orderNumber: state.orderData?.orderNumber,
      allNearbyDeliveryBoyIds: state.allNearbyDeliveryBoyIds,
      currentIndex: state.currentIndex,
      notifiedDeliveryBoys: Array.from(state.notifiedDeliveryBoys || []),
      rejectedDeliveryBoys: Array.from(state.rejectedDeliveryBoys || []),
      acceptedBy: state.acceptedBy,
      hasActiveTimeout: !!state.timeoutId,
    }));

    res.json({
      success: true,
      totalConnections: sockets.length,
      activeNotificationsCount: activeNotifications.length,
      activeNotifications,
      sockets,
      allRooms,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Debug middleware - log all incoming requests (suppressed in production to
// avoid synchronous stdout writes blocking the event loop on every request).
app.use((req: Request, _res: Response, next) => {
  logger.debug(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rate limiting to shed load and protect against bursts/abuse. Generous limit
// so legitimate traffic (incl. polling clients) is unaffected.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_MAX) || hostingDefaults.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again shortly." },
});

// API Routes
app.use("/api/v1", apiLimiter, routes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Connect DB then ensure default admin exists
  await connectDB();
  await ensureDefaultAdmin();
  await seedHeaderCategories();

  httpServer.listen(PORT, () => {
    console.log("\n\x1b[32m✓\x1b[0m \x1b[1mKosil Server Started\x1b[0m");
    console.log(`   \x1b[36mPort:\x1b[0m http://localhost:${PORT}`);
    console.log(
      `   \x1b[36mEnvironment:\x1b[0m ${process.env.NODE_ENV || "development"}`
    );
    console.log(`   \x1b[36mSocket.IO:\x1b[0m ✓ Ready for connections`);
    if (isSharedHosting) {
      console.log(`   \x1b[33mHosting:\x1b[0m shared (conservative pool/limits)\n`);
    } else {
      console.log("");
    }
  });
}

// Graceful shutdown: stop accepting new connections and close the DB pool so
// the process manager can restart us cleanly without leaking connections.
let shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received. Shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 15000);
  forceExit.unref();

  try {
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await mongoose.connection.close(false);
    clearTimeout(forceExit);
    console.log("Shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer().catch((err) => {
  console.error("\n\x1b[31m✗ Failed to start server\x1b[0m");
  console.error(err);
  process.exit(1);
});
