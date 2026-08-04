const fs = require("fs");

const audit = JSON.parse(fs.readFileSync("migration-audit.json", "utf8"));
const rawZip = fs.readFileSync("scratch/zip-entries.txt", "utf8").split("\n");

const zipEntries = new Set();
for (let line of rawZip) {
  line = line.trim();
  if (line) {
    zipEntries.add(line.toLowerCase());
    zipEntries.add(decodeURIComponent(line).toLowerCase());
  }
}

let matchCount = 0;
let failCount = 0;
const matchedKeys = [];
const missingKeys = [];

for (const item of audit) {
  const newUrl = item.newUrl; // e.g. https://api.wasgromart.com/uploads/products/ziy9g4ugbz4ruu1cb4wk.jpg
  let key = newUrl.replace("https://api.wasgromart.com/uploads/", "").toLowerCase();
  
  // also check if key has Wasgro%20mart or Wasgro mart or relative paths
  const decodedKey = decodeURIComponent(key);

  const candidates = [
    `cloudinary/${key}`,
    `cloudinary/${decodedKey}`,
    `cloudinary/wasgro mart/${key}`,
    `cloudinary/wasgro mart/${decodedKey}`,
    `cloudinary/${key.replace('wasgro mart/', '')}`,
    `cloudinary/${decodedKey.replace('wasgro mart/', '')}`,
  ];

  let found = false;
  for (const c of candidates) {
    if (zipEntries.has(c)) {
      found = true;
      break;
    }
  }

  if (found) {
    matchCount++;
    if (matchedKeys.length < 10) matchedKeys.push(key);
  } else {
    failCount++;
    if (missingKeys.length < 10) missingKeys.push({ oldUrl: item.oldUrl, key });
  }
}

console.log("=== RESULTS ===");
console.log("Total audit URLs in DB:", audit.length);
console.log("Matching images found in d:/cloudinary.zip:", matchCount);
console.log("Missing images not in d:/cloudinary.zip:", failCount);
console.log("\nSample matched keys:", matchedKeys);
console.log("\nSample missing keys:", missingKeys);
