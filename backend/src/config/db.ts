import mongoose from 'mongoose';
import axios from 'axios';
import { ensureEnvLoaded } from "./env";
import { hostingDefaults } from "./hosting";

ensureEnvLoaded();

// Resolve MongoDB SRV via DNS-over-HTTPS (port 443) to bypass corporate DNS/firewall blocks
async function resolveMongoSRV(uri: string): Promise<string> {
  const srvMatch = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)\/?(.*)/);
  if (!srvMatch) return uri;

  const [, user, pass, host, rest] = srvMatch;
  const srvName = `_mongodb._tcp.${host}`;

  console.log(`   Resolving SRV via DNS-over-HTTPS: ${srvName}`);

  // Try Google DoH, then Cloudflare DoH — both use port 443
  const dohProviders = [
    `https://dns.google/resolve?name=${srvName}&type=SRV`,
    `https://cloudflare-dns.com/dns-query?name=${srvName}&type=SRV`,
  ];

  for (const url of dohProviders) {
    try {
      const response = await axios.get(url, {
        headers: { Accept: 'application/dns-json' },
        timeout: 8000,
      });

      const answers: Array<{ data: string }> = response.data?.Answer;
      if (!answers || answers.length === 0) continue;

      // SRV data format: "priority weight port target"
      const hosts = answers
        .map(a => {
          const parts = a.data.trim().split(/\s+/);
          const port = parts[2];
          const target = parts[3].replace(/\.$/, ''); // strip trailing dot
          return `${target}:${port}`;
        })
        .join(',');

      const dbName = rest.split('?')[0] || 'admin';
      const directUri = `mongodb://${user}:${pass}@${hosts}/${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;
      console.log(`   Resolved ${answers.length} host(s) via DoH`);
      return directUri;
    } catch (err) {
      console.warn(`   DoH provider failed (${url.split('/')[2]}): ${(err as Error).message}`);
    }
  }

  console.warn('   All DoH providers failed, using original SRV URI');
  return uri;
}

// Attach connection lifecycle listeners exactly once so transient Atlas blips
// under load are logged and handled gracefully instead of crashing the process.
let listenersAttached = false;
function attachConnectionListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  const connection = mongoose.connection;

  connection.on('error', (err) => {
    // Do NOT exit the process here. A connection error under load (pool
    // timeout, replica-set election, network blip) must not take down the
    // entire server for all users. The driver will attempt to recover.
    console.error('\x1b[31mMongoDB connection error:\x1b[0m', err?.message || err);
  });

  connection.on('disconnected', () => {
    console.warn('\x1b[33m⚠ MongoDB disconnected.\x1b[0m The driver will attempt to reconnect automatically.');
  });

  connection.on('reconnected', () => {
    console.log('\x1b[32m✓ MongoDB reconnected.\x1b[0m');
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async (): Promise<void> => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  let mongoUri = process.env.MONGODB_URI;

  // On shared hosting, Atlas SRV resolves via the host's DNS. DoH adds a boot-time
  // HTTPS call and can fail when outbound requests are restricted.
  if (mongoUri.startsWith('mongodb+srv://') && hostingDefaults.useDohSrvResolution) {
    mongoUri = await resolveMongoSRV(mongoUri);
  }

  attachConnectionListeners();

  // Pool sizing: cap concurrent connections so a burst of traffic cannot open an
  // unbounded number of sockets to Atlas (the mongoose/driver default is 100).
  const maxPoolSize =
    Number(process.env.MONGO_MAX_POOL_SIZE) || hostingDefaults.mongoMaxPoolSize;
  const minPoolSize =
    Number(process.env.MONGO_MIN_POOL_SIZE) || hostingDefaults.mongoMinPoolSize;

  const connectOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize,
    minPoolSize,
    // Drop idle connections so the pool shrinks back down after a spike.
    maxIdleTimeMS: 60000,
    // Wait (rather than fail instantly) when the pool is momentarily saturated.
    waitQueueTimeoutMS: 10000,
  } as const;

  // Retry the INITIAL connection with exponential backoff instead of exiting,
  // so a slow database or DNS at boot time during a restart storm does not put
  // the process into an instant crash loop.
  const maxAttempts = Number(process.env.MONGO_CONNECT_MAX_ATTEMPTS) || 10;
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const conn = await mongoose.connect(mongoUri, connectOptions);

      console.log('\n\x1b[32m✓\x1b[0m \x1b[1mMongoDB Connected Successfully\x1b[0m');
      console.log(`   \x1b[36mHost:\x1b[0m ${conn.connection.host}`);
      console.log(`   \x1b[36mDatabase:\x1b[0m ${conn.connection.name}`);
      console.log(`   \x1b[36mPool:\x1b[0m min=${minPoolSize} max=${maxPoolSize}\n`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('\n\x1b[31m✗\x1b[0m \x1b[1mMongoDB Connection Error\x1b[0m');
      console.error(`   \x1b[31m${message}\x1b[0m (attempt ${attempt}/${maxAttempts})\n`);

      if (attempt >= maxAttempts) {
        // Give up on the initial connection after exhausting retries. We rethrow
        // rather than process.exit so the caller controls shutdown behaviour.
        throw new Error(`Failed to connect to MongoDB after ${maxAttempts} attempts: ${message}`);
      }

      const backoffMs = Math.min(30000, 1000 * 2 ** (attempt - 1));
      console.log(`   Retrying in ${Math.round(backoffMs / 1000)}s...`);
      await sleep(backoffMs);
    }
  }
};

export default connectDB;
