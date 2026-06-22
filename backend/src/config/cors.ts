import type { CorsOptions } from "cors";

/** Strip quotes/whitespace from env values (Hostinger sometimes wraps values in '...'). */
function cleanEnvUrl(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "").toLowerCase();
}

const DEFAULT_ORIGINS = [
  "https://wasgromart.com",
  "https://www.wasgromart.com",
  "http://wasgromart.com",
  "http://www.wasgromart.com",
  "https://www.kosil.com",
  "https://kosil.com",
  "https://kosil-frontend.onrender.com",
  "https://kosil.biz",
];

function buildAllowedOrigins(): Set<string> {
  const fromEnv = (process.env.FRONTEND_URL || "")
    .split(",")
    .map(cleanEnvUrl)
    .filter(Boolean);

  const all = [...DEFAULT_ORIGINS, ...fromEnv];
  const normalized = new Set<string>();

  for (const origin of all) {
    const n = normalizeOrigin(origin);
    normalized.add(n);
    // www ↔ non-www variants
    if (n.includes("://www.")) {
      normalized.add(n.replace("://www.", "://"));
    } else if (n.match(/^https?:\/\/[^/]+/)) {
      normalized.add(n.replace("://", "://www."));
    }
  }

  return normalized;
}

const allowedOrigins = buildAllowedOrigins();

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins.has(normalizeOrigin(origin));
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    // Dev: allow any localhost port
    if (
      process.env.NODE_ENV !== "production" &&
      origin &&
      (origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:"))
    ) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

/** Attach CORS headers on error responses (preflight / 5xx without cors middleware). */
export function applyCorsHeaders(
  req: { headers: { origin?: string } },
  res: { setHeader: (k: string, v: string) => void }
): void {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
}
