const fs = require("fs");

const audit = JSON.parse(fs.readFileSync("migration-audit.json", "utf8"));
const zipEntriesList = fs.readFileSync("scratch/zip-entries.txt", "utf8").split("\n");

const zipEntries = new Set();
for (let entry of zipEntriesList) {
  entry = entry.trim();
  if (entry) {
    zipEntries.add(entry.toLowerCase());
    zipEntries.add(decodeURIComponent(entry).toLowerCase());
  }
}

let matchCount = 0;
let failCount = 0;
const matchedExamples = [];
const failedExamples = [];

for (const item of audit) {
  let oldUrl = item.oldUrl;
  
  // Extract path after upload/v12345/ or upload/
  const m = oldUrl.match(/upload\/(?:v\d+\/)?(.+)/);
  if (!m) continue;

  let relPath = m[1].toLowerCase();
  relPath = decodeURIComponent(relPath);

  // Try different prefix variations
  const variants = [
    `cloudinary/${relPath}`,
    `cloudinary/${relPath.replace("wasgro mart/", "")}`,
    `cloudinary/${relPath.replace("wasgro%20mart/", "")}`,
    `cloudinary/products/${relPath}`,
    `cloudinary/speeup/${relPath}`,
  ];

  let found = false;
  let matchedVariant = "";
  for (const v of variants) {
    if (zipEntries.has(v)) {
      found = true;
      matchedVariant = v;
      break;
    }
  }

  if (found) {
    matchCount++;
    if (matchedExamples.length < 10) matchedExamples.push({ oldUrl, matchedVariant });
  } else {
    failCount++;
    if (failedExamples.length < 10) failedExamples.push({ oldUrl, relPath });
  }
}

console.log("=== DV1L9SB4P MAPPING MATCHING ===");
console.log("Total DB audit URLs:", audit.length);
console.log("Matched in dv1l9sb4p archive:", matchCount);
console.log("Unmatched in archive:", failCount);
console.log("\nSample Matched Examples:", matchedExamples);
console.log("\nSample Failed Examples:", failedExamples);
