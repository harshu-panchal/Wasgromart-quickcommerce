const fs = require("fs");
const path = require("path");

const UPLOADS_DIR = "d:/AppZeto/wasgromart/uploads";
const CLOUDINARY_DIR = path.join(UPLOADS_DIR, "cloudinary");

function moveRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const items = fs.readdirSync(src);
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      moveRecursive(srcPath, destPath);
    } else {
      // Don't overwrite if destination exists, skip .meta.json
      if (item.endsWith(".meta.json")) {
        fs.unlinkSync(srcPath);
        continue;
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.renameSync(srcPath, destPath);
    }
  }
}

async function main() {
  console.log("Organizing uploads directory...");

  if (fs.existsSync(CLOUDINARY_DIR)) {
    moveRecursive(CLOUDINARY_DIR, UPLOADS_DIR);
    try {
      fs.rmdirSync(CLOUDINARY_DIR, { recursive: true });
    } catch(e) {}
  }

  // Ensure default/placeholder.png exists
  const defaultDir = path.join(UPLOADS_DIR, "default");
  fs.mkdirSync(defaultDir, { recursive: true });
  const placeholderPath = path.join(defaultDir, "placeholder.png");

  const logoSrc = "d:/AppZeto/wasgromart/afrontend/public/assets/wasgromart-logo-v2.png";
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, placeholderPath);
    console.log("✅ Created default placeholder at:", placeholderPath);
  }

  console.log("\n📁 Final uploads root folders:");
  console.log(fs.readdirSync(UPLOADS_DIR).slice(0, 30));
}

main();
