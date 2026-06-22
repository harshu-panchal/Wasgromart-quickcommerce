import { ensureEnvLoaded } from "./env";

ensureEnvLoaded();

/**
 * Shared-hosting profile (Hostinger, cPanel Node, etc.).
 *
 * On shared hosting you typically get:
 * - ONE Node process (no clustering)
 * - 256–1024 MB RAM hard limit (LVE / cgroup OOM-kill → restart loop)
 * - A reverse proxy in front with short idle/WebSocket timeouts
 * - Outbound DNS that may block custom resolvers or DoH
 *
 * Set SHARED_HOSTING=true in the Hostinger environment panel, or we auto-detect
 * common Hostinger paths.
 */
function detectSharedHosting(): boolean {
  if (process.env.SHARED_HOSTING === "true") return true;
  if (process.env.SHARED_HOSTING === "false") return false;

  const cwd = process.cwd();
  // Hostinger Node apps live under ~/domains/<domain>/nodejs or ~/nodejs
  if (/\/domains\/[^/]+\/nodejs/i.test(cwd)) return true;
  if (/\/u\d+\/domains\//i.test(cwd)) return true;

  return false;
}

export const isSharedHosting = detectSharedHosting();

/** Conservative defaults when running on a memory-constrained shared host. */
export const hostingDefaults = {
  mongoMaxPoolSize: isSharedHosting ? 10 : 50,
  mongoMinPoolSize: isSharedHosting ? 1 : 5,
  rateLimitMax: isSharedHosting ? 300 : 600,
  // Hostinger/LiteSpeed often gzip at the edge; skip in-app compression to save CPU.
  useCompression: process.env.USE_COMPRESSION !== "false" && !isSharedHosting,
  // Custom dns.setServers() is blocked or harmful on some shared hosts.
  useCustomDnsServers: !isSharedHosting,
  // DoH SRV resolution adds a boot-time HTTPS call; Atlas SRV works on Hostinger.
  useDohSrvResolution: !isSharedHosting && process.env.MONGO_USE_DOH === "true",
  socketPerMessageDeflate: !isSharedHosting,
} as const;
