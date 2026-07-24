/**
 * Phase 2: Upload Images to Hostinger Server via SFTP (Plain JS version)
 * Usage: node src/scripts/uploadToServer.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

const MAP_FILE = path.resolve(__dirname, "../../cloudinary-map.json");
const LOG_FILE = path.resolve(__dirname, "../../upload-report.json");

const SSH_CONFIG = {
  host: "147.93.99.211",
  port: 65002,
  username: "u910031778",
  password: "Wasgro@#123",
};

const REMOTE_UPLOAD_DIR = "/home/u910031778/domains/api.wasgromart.com/uploads";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("Phase 2: Upload Images to Hostinger Server");
  console.log("==========================================");
  if (isDryRun) {
    console.log("DRY RUN MODE — no files will be uploaded\n");
  } else {
    console.log();
  }

  if (!fs.existsSync(MAP_FILE)) {
    console.error("Mapping file not found: " + MAP_FILE);
    console.error("Run buildCloudinaryMap.js first!");
    process.exit(1);
  }

  const mapping = JSON.parse(fs.readFileSync(MAP_FILE, "utf-8"));

  const uniqueFiles = new Map();
  for (const entry of Object.values(mapping)) {
    if (entry.fileExists && !uniqueFiles.has(entry.serverKey)) {
      uniqueFiles.set(entry.serverKey, entry);
    }
  }

  const filesToUpload = Array.from(uniqueFiles.values());
  const totalBytes = filesToUpload.reduce((sum, e) => sum + e.bytes, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

  console.log("Files to upload: " + filesToUpload.length);
  console.log("Total size: ~" + totalMB + " MB");
  console.log("Remote directory: " + REMOTE_UPLOAD_DIR + "\n");

  if (isDryRun) {
    const folderCounts = {};
    for (const entry of filesToUpload) {
      folderCounts[entry.serverFolder] = (folderCounts[entry.serverFolder] || 0) + 1;
    }
    console.log("Files by folder (would upload):");
    for (const [folder, count] of Object.entries(folderCounts).sort((a, b) => b[1] - a[1])) {
      console.log("  " + folder.padEnd(25) + " " + count + " files");
    }
    console.log("\nDry run complete. Run without --dry-run to upload.");
    return;
  }

  let SFTPClient;
  try {
    SFTPClient = require("ssh2-sftp-client");
  } catch {
    console.error("❌ ssh2-sftp-client is not installed yet!");
    console.error("   Run: npm install ssh2-sftp-client --legacy-peer-deps");
    process.exit(1);
  }

  const sftp = new SFTPClient();
  const report = {
    startTime: new Date().toISOString(),
    endTime: "",
    totalFiles: filesToUpload.length,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    failures: [],
    totalBytes,
  };

  try {
    console.log("Connecting to " + SSH_CONFIG.host + ":" + SSH_CONFIG.port + "...");
    await sftp.connect(SSH_CONFIG);
    console.log("Connected!\n");

    const remoteDirs = new Set();
    for (const entry of filesToUpload) {
      const remoteDir = path.posix.dirname(REMOTE_UPLOAD_DIR + "/" + entry.serverKey);
      remoteDirs.add(remoteDir);
    }

    // Ensure remote upload directory structure step by step starting from REMOTE_UPLOAD_DIR
    try {
      await sftp.mkdir(REMOTE_UPLOAD_DIR, true);
    } catch (e) {}

    const createdDirs = new Set();
    async function ensureDir(remoteDir) {
      const relPath = path.posix.relative(REMOTE_UPLOAD_DIR, remoteDir);
      if (!relPath || relPath === "." || relPath.startsWith("..")) return;
      const parts = relPath.split("/");
      let current = REMOTE_UPLOAD_DIR;
      for (const part of parts) {
        current += "/" + part;
        if (!createdDirs.has(current)) {
          try {
            await sftp.mkdir(current, false);
          } catch (err) {}
          createdDirs.add(current);
        }
      }
    }

    console.log("Creating " + remoteDirs.size + " remote directories...");
    for (const dir of remoteDirs) {
      await ensureDir(dir);
    }
    console.log("Directories ready\n");

    let completed = 0;
    const startTime = Date.now();

    for (const entry of filesToUpload) {
      const remotePath = REMOTE_UPLOAD_DIR + "/" + entry.serverKey;
      completed++;

      const pct = ((completed / filesToUpload.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(
        "\r  [" + pct + "%] " + completed + "/" + filesToUpload.length + " | " + elapsed + "s | " + entry.serverKey.substring(0, 45)
      );

      try {
        let remoteExists = false;
        try {
          const stat = await sftp.stat(remotePath);
          if (stat && stat.size === entry.bytes) {
            remoteExists = true;
          }
        } catch (e) {
          // file doesn't exist
        }

        if (remoteExists) {
          report.skipped++;
          continue;
        }

        await sftp.put(entry.localFilePath, remotePath);
        report.uploaded++;
      } catch (err) {
        report.failed++;
        report.failures.push({
          file: entry.serverKey,
          error: err.message || String(err),
        });
      }
    }

    console.log("\n");
  } catch (err) {
    console.error("\nSFTP Error: " + err.message);
    throw err;
  } finally {
    await sftp.end();
    console.log("SFTP connection closed\n");
  }

  report.endTime = new Date().toISOString();
  fs.writeFileSync(LOG_FILE, JSON.stringify(report, null, 2));

  console.log("==========================================");
  console.log("Upload Report:");
  console.log("  Uploaded: " + report.uploaded);
  console.log("  Skipped (already exists): " + report.skipped);
  console.log("  Failed: " + report.failed);
  console.log("  Total size: ~" + totalMB + " MB");
  if (report.failures.length > 0) {
    console.log("\nFailed files:");
    for (const f of report.failures.slice(0, 10)) {
      console.log("  - " + f.file + ": " + f.error);
    }
  }
  console.log("\nFull report saved to: " + LOG_FILE);
  console.log("\nPhase 2 complete! Next: run migrateCloudinaryUrls.js");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
