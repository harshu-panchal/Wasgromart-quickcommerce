/**
 * Lightweight logger that suppresses high-volume debug/info logs in production.
 *
 * Rationale: `console.log` writes to stdout synchronously. When stdout is a pipe
 * (pm2 / Docker / systemd-journald) high-frequency logging on hot paths (every
 * HTTP request, every socket event) serializes and blocks the event loop, which
 * causes Socket.IO ping timeouts, mass disconnects and health-check failures.
 *
 * In production, only warnings and errors are emitted. Set LOG_DEBUG=true to
 * force verbose logging in production temporarily for debugging.
 */
const isProd = process.env.NODE_ENV === "production";
const forceDebug = process.env.LOG_DEBUG === "true";

const debugEnabled = !isProd || forceDebug;

export const logger = {
  /** Verbose, high-volume logs. Suppressed in production unless LOG_DEBUG=true. */
  debug: (...args: unknown[]): void => {
    if (debugEnabled) console.log(...args);
  },
  /** Informational logs. Suppressed in production unless LOG_DEBUG=true. */
  info: (...args: unknown[]): void => {
    if (debugEnabled) console.log(...args);
  },
  /** Warnings are always emitted. */
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  /** Errors are always emitted. */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};

export default logger;
