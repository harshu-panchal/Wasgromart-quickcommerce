/**
 * Download all images from Cloudinary account dpfkjdyy6
 * and sync them directly to Hostinger local storage.
 * 
 * Credentials:
 *   cloud_name: dpfkjdyy6
 *   api_key:    715738272914696
 *   api_secret: LX7fU96dlOZoEs0iNTuswOciKmQ
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const SFTPClient = require("ssh2-sftp-client");

const CLOUD_NAME = "dpfkjdyy6";
const API_KEY = "715738272914696";
const API_SECRET = "LX7fU96dlOZoEs0iNTuswOciKmQ";

const SSH_CONFIG = {
  host: "147.93.99.211",
  port: 65002,
  username: "u910031778",
  password: "Wasgro@#123",
  readyTimeout: 30000,
  retries: 5,
};

const LOCAL_UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
const REMOTE_UPLOAD_DIR = "/home/u910031778/domains/api.wasgromart.com/uploads";

function authHeader() {
  return "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
}

function apiGet(pathStr) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.cloudinary.com",
      path: `/v1_1/${CLOUD_NAME}${pathStr}`,
      method: "GET",
      headers: {
        Authorization: authHeader(),
        "User-Agent": "cloudinary-sync/1.0",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function downloadFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const lib = fileUrl.startsWith("https") ? https : http;

    lib.get(fileUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on("finish", () => fileStream.close(resolve));
      fileStream.on("error", reject);
    }).on("error", reject);
  });
}

async function fetchAllResources() {
  console.log(`🔍 Fetching resource list from Cloudinary (${CLOUD_NAME})...`);
  let nextCursor = null;
  const allResources = [];

  do {
    let url = `/resources/image/upload?max_results=500`;
    if (nextCursor) {
      url += `&next_cursor=${encodeURIComponent(nextCursor)}`;
    }

    const res = await apiGet(url);
    if (res.error) {
      console.error(`❌ Cloudinary Error:`, res.error.message);
      if (res.error.message.includes("disabled customer")) {
        console.error("\n⚠️  ACCOUNT IS DISABLED IN CLOUDINARY DASHBOARD!");
        console.error("   Please log into https://console.cloudinary.com for account 'dpfkjdyy6'");
        console.error("   and click 'Reactivate Account' / clear pending alerts to enable API access.");
      }
      process.exit(1);
    }

    if (res.resources && res.resources.length > 0) {
      allResources.push(...res.resources);
      console.log(`   Fetched ${allResources.length} assets so far...`);
    }

    nextCursor = res.next_cursor || null;
  } while (nextCursor);

  return allResources;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║    Downloading & Syncing dpfkjdyy6 Assets to Server     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const resources = await fetchAllResources();
  console.log(`\n✅ Total assets found in Cloudinary: ${resources.length}`);

  // Download locally & Prepare for SFTP
  console.log(`\n⬇️  Downloading assets to local storage...`);
  const downloadedFiles = [];

  for (let i = 0; i < resources.length; i++) {
    const item = resources[i];
    let publicId = item.public_id; // e.g. "Wasgro mart/products/fceocuweyzwzvuripgb9"
    let format = item.format || "jpg";
    let secureUrl = item.secure_url;

    // Clean public_id for local storage path
    let relPath = publicId.replace(/^Wasgro\s*mart\//i, ""); // e.g. "products/fceocuweyzwzvuripgb9"
    if (!path.extname(relPath)) {
      relPath += `.${format}`;
    }

    const localPath = path.join(LOCAL_UPLOAD_DIR, relPath);
    process.stdout.write(`\r   [${i + 1}/${resources.length}] Downloading: ${relPath.slice(0, 45)}`);

    try {
      if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
        await downloadFile(secureUrl, localPath);
      }
      downloadedFiles.push({ localPath, relPath, size: fs.statSync(localPath).size });
    } catch (e) {
      console.error(`\n❌ Failed to download ${publicId}: ${e.message}`);
    }
  }

  console.log(`\n✅ Download complete! ${downloadedFiles.length} files ready for server upload.\n`);

  // Sync to Hostinger via SFTP
  const sftp = new SFTPClient();
  try {
    console.log(`🔗 Connecting to Hostinger (${SSH_CONFIG.host}:${SSH_CONFIG.port})...`);
    await sftp.connect(SSH_CONFIG);
    console.log("✅ Connected to Hostinger SFTP!");

    const remoteDirs = new Set();
    for (const f of downloadedFiles) {
      remoteDirs.add(path.posix.dirname(`${REMOTE_UPLOAD_DIR}/${f.relPath}`));
    }

    for (const d of remoteDirs) {
      try { await sftp.mkdir(d, true); } catch (e) {}
    }

    console.log(`🚀 Uploading ${downloadedFiles.length} files to server...`);
    let uploaded = 0;
    let skipped = 0;

    for (let i = 0; i < downloadedFiles.length; i++) {
      const f = downloadedFiles[i];
      const remotePath = `${REMOTE_UPLOAD_DIR}/${f.relPath}`;
      process.stdout.write(`\r   [${i + 1}/${downloadedFiles.length}] Uploading: ${f.relPath.slice(0, 45)}`);

      try {
        const stat = await sftp.stat(remotePath).catch(() => null);
        if (stat && stat.size === f.size) {
          skipped++;
          continue;
        }
        await sftp.fastPut(f.localPath, remotePath);
        uploaded++;
      } catch (e) {
        console.error(`\n❌ Failed uploading ${f.relPath}: ${e.message}`);
      }
    }

    console.log("\n\n🎉 ALL DONE!");
    console.log(` Uploaded: ${uploaded}`);
    console.log(` Skipped:  ${skipped}`);
  } catch (err) {
    console.error("❌ SFTP Error:", err.message);
  } finally {
    try { await sftp.end(); } catch (e) {}
  }
}

main();
