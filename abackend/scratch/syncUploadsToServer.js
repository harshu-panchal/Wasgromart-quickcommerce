const fs = require("fs");
const path = require("path");
const SFTPClient = require("ssh2-sftp-client");

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

const FOLDERS_TO_UPLOAD = [
  "default",
  "products",
  "categories",
  "subcategories",
  "sub-subcategories",
  "banners",
  "media",
  "delivery",
  "sellers",
  "seller_documents",
  "settings",
  "app-settings",
  "popups",
  "promo-strips",
  "range-cards",
  "experience-banners",
  "returns",
  "speeup",
];

async function getLocalFiles() {
  const files = [];
  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        files.push({
          localPath: fullPath,
          relPath: path.relative(LOCAL_UPLOAD_DIR, fullPath).replace(/\\/g, "/"),
          size: stat.size,
        });
      }
    }
  }
  for (const folder of FOLDERS_TO_UPLOAD) {
    walk(path.join(LOCAL_UPLOAD_DIR, folder));
  }
  return files;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Syncing Wasgromart Uploads to Hostinger Server      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  const allFiles = await getLocalFiles();
  console.log(`📦 Found ${allFiles.length} files to process.`);

  let sftp = new SFTPClient();
  let isConnected = false;

  async function connectSFTP() {
    if (isConnected) return;
    try {
      await sftp.end();
    } catch(e) {}
    sftp = new SFTPClient();
    console.log(`🔗 Connecting to Hostinger (${SSH_CONFIG.host}:${SSH_CONFIG.port})...`);
    await sftp.connect(SSH_CONFIG);
    isConnected = true;
    console.log("✅ SFTP Connected!");
  }

  await connectSFTP();

  // Create base remote upload dir
  try {
    await sftp.mkdir(REMOTE_UPLOAD_DIR, true);
  } catch(e) {}

  // Collect unique remote directories
  const remoteDirs = new Set();
  for (const file of allFiles) {
    const remoteDir = path.posix.dirname(`${REMOTE_UPLOAD_DIR}/${file.relPath}`);
    remoteDirs.add(remoteDir);
  }

  console.log(`📁 Creating ${remoteDirs.size} remote directories if needed...`);
  for (const remoteDir of remoteDirs) {
    try {
      await sftp.mkdir(remoteDir, true);
    } catch(e) {
      // Ignore if dir exists
    }
  }
  console.log("✅ All remote directories ready.\n");

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const remotePath = `${REMOTE_UPLOAD_DIR}/${file.relPath}`;
    const pct = (((i + 1) / allFiles.length) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    process.stdout.write(
      `\r   [${pct}%] ${i + 1}/${allFiles.length} | ${elapsed}s | ${file.relPath.slice(0, 45)}`
    );

    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      attempts++;
      try {
        if (!isConnected) {
          await connectSFTP();
        }

        // Check if file exists with same size
        let remoteSize = -1;
        try {
          const stat = await sftp.stat(remotePath);
          remoteSize = stat ? stat.size : -1;
        } catch(e) {}

        if (remoteSize === file.size) {
          skipped++;
          success = true;
          break;
        }

        await sftp.fastPut(file.localPath, remotePath);
        uploaded++;
        success = true;
      } catch (err) {
        isConnected = false;
        if (attempts >= 3) {
          failed++;
          console.error(`\n❌ Failed uploading ${file.relPath}: ${err.message}`);
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  console.log("\n\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  Sync Summary                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(` Total files:   ${allFiles.length}`);
  console.log(` Uploaded:      ${uploaded}`);
  console.log(` Skipped:       ${skipped} (already exist on server)`);
  console.log(` Failed:        ${failed}`);
  console.log(` Time taken:    ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  try {
    await sftp.end();
  } catch(e) {}
}

main();
