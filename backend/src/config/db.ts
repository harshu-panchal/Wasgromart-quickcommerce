import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

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

const connectDB = async (): Promise<void> => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    let mongoUri = process.env.MONGODB_URI;

    if (mongoUri.startsWith('mongodb+srv://')) {
      mongoUri = await resolveMongoSRV(mongoUri);
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log('\n\x1b[32m✓\x1b[0m \x1b[1mMongoDB Connected Successfully\x1b[0m');
    console.log(`   \x1b[36mHost:\x1b[0m ${conn.connection.host}`);
    console.log(`   \x1b[36mDatabase:\x1b[0m ${conn.connection.name}\n`);
  } catch (error) {
    console.error('\n\x1b[31m✗\x1b[0m \x1b[1mMongoDB Connection Error\x1b[0m');
    if (error instanceof Error) {
      console.error(`   \x1b[31m${error.message}\x1b[0m\n`);
    } else {
      console.error(`   \x1b[31m${String(error)}\x1b[0m\n`);
    }
    process.exit(1);
  }
};

export default connectDB;
