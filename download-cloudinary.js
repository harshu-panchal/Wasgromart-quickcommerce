/**
 * Cloudinary Asset Downloader
 * ----------------------------
 * Downloads ALL assets from Cloudinary (images, raw, video) preserving the
 * original folder structure.  Also writes a .meta.json sidecar file next to
 * each asset and a master index.json at the output root.
 *
 * Usage (run from wasgromart root):
 *   node download-cloudinary.js
 *
 * Output:  afrontend/public/assets/cloudinary/
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { URL } = require('url');

// ─── Cloudinary credentials ───────────────────────────────────────────────────
const CLOUD_NAME = 'dv1l9sb4p';
const API_KEY    = '737441146281892';
const API_SECRET = 'N6n7NdoFLDcEDnXPZCw8AoEC04c';

// ─── Output directory ─────────────────────────────────────────────────────────
const OUT_DIR = path.join(__dirname, 'afrontend', 'public', 'assets', 'cloudinary');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64Auth() {
  return Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
}

/** Make a GET request to the Cloudinary Admin API → resolves to {status, body}. */
function apiGet(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const options = {
      hostname : parsed.hostname,
      path     : parsed.pathname + parsed.search,
      method   : 'GET',
      headers  : {
        Authorization : `Basic ${base64Auth()}`,
        'User-Agent'  : 'cloudinary-downloader/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 300)}`)); }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/** Download a binary file from any URL to a local path (follows redirects). */
function downloadFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const get = (url, depth = 0) => {
      if (depth > 10) return reject(new Error('Too many redirects'));
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      lib
        .get(url, { headers: { 'User-Agent': 'cloudinary-downloader/1.0' } }, (res) => {
          const { statusCode, headers } = res;
          if ([301, 302, 303, 307, 308].includes(statusCode)) {
            res.resume();
            return get(headers.location, depth + 1);
          }
          if (statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${statusCode} → ${url}`));
          }
          const ws = fs.createWriteStream(destPath);
          res.pipe(ws);
          ws.on('finish', () => ws.close(resolve));
          ws.on('error',  reject);
        })
        .on('error', reject);
    };

    get(fileUrl);
  });
}

/** Turn a Cloudinary public_id + format into a safe relative file path. */
function publicIdToRelPath(publicId, format) {
  // public_id may already contain an extension – don't double-add
  const hasExt = /\.[a-zA-Z0-9]+$/.test(publicId);
  const relPath = hasExt ? publicId : `${publicId}.${format}`;
  // Replace characters that are invalid on Windows
  return relPath.replace(/[<>:"|?*\0]/g, '_');
}

/** Fetch one paginated page of resources. */
async function fetchPage(resourceType, nextCursor) {
  let url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${resourceType}?max_results=500`;
  if (nextCursor) url += `&next_cursor=${encodeURIComponent(nextCursor)}`;
  const { status, body } = await apiGet(url);
  if (status !== 200) throw new Error(`Admin API error ${status}: ${JSON.stringify(body)}`);
  return body;
}

/** Fetch ALL resources (all pages, all resource types). */
async function fetchAllResources() {
  const resourceTypes = ['image', 'raw', 'video'];
  const all = [];

  for (const rType of resourceTypes) {
    console.log(`\n📡 Fetching ${rType} resources…`);
    let nextCursor = null;
    let page = 1;
    do {
      const data = await fetchPage(rType, nextCursor);
      const resources = data.resources || [];
      console.log(`   Page ${page}: ${resources.length} ${rType}(s)`);
      all.push(...resources);
      nextCursor = data.next_cursor || null;
      page++;
    } while (nextCursor);
  }

  return all;
}

/** List all folders in the account. */
async function fetchFolders() {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/folders`;
  const { status, body } = await apiGet(url);
  if (status !== 200) { console.warn('⚠️  Could not list folders:', body); return []; }
  return (body.folders || []).map((f) => f.path);
}

/** Fetch resources inside a specific folder path (all types, all pages). */
async function fetchResourcesInFolder(folderPath) {
  const resourceTypes = ['image', 'raw', 'video'];
  const all = [];
  for (const rType of resourceTypes) {
    let nextCursor = null;
    let page = 1;
    do {
      let url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${rType}` +
                `?prefix=${encodeURIComponent(folderPath + '/')}&max_results=500`;
      if (nextCursor) url += `&next_cursor=${encodeURIComponent(nextCursor)}`;
      const { status, body } = await apiGet(url);
      if (status !== 200) break;
      const resources = body.resources || [];
      if (resources.length) {
        console.log(`   Folder "${folderPath}" / ${rType} page ${page}: ${resources.length} item(s)`);
      }
      all.push(...resources);
      nextCursor = body.next_cursor || null;
      page++;
    } while (nextCursor);
  }
  return all;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║        Cloudinary → Local Asset Downloader           ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`Cloud : ${CLOUD_NAME}`);
  console.log(`Output: ${OUT_DIR}\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. Fetch root-level resources
  let resources = await fetchAllResources();

  // 2. Scan folders to catch nested assets that may be missing from the root listing
  const folders = await fetchFolders();
  if (folders.length) {
    console.log(`\n📂 Found ${folders.length} folder(s): ${folders.join(', ')}`);
    for (const folder of folders) {
      const extra = await fetchResourcesInFolder(folder);
      resources.push(...extra);
    }
  }

  // 3. Deduplicate by public_id
  const seen = new Set();
  resources = resources.filter((r) => {
    if (seen.has(r.public_id)) return false;
    seen.add(r.public_id);
    return true;
  });

  console.log(`\n✅ Total unique assets to process: ${resources.length}`);
  if (resources.length === 0) { console.log('Nothing to download. Exiting.'); return; }

  // 4. Download each asset + write metadata sidecar
  const masterIndex = [];
  let downloaded = 0, skipped = 0, failed = 0;

  for (let i = 0; i < resources.length; i++) {
    const r = resources[i];
    const relPath    = publicIdToRelPath(r.public_id, r.format || 'bin');
    const destPath   = path.join(OUT_DIR, relPath);
    const metaPath   = destPath + '.meta.json';
    const deliveryUrl = r.secure_url ||
      `https://res.cloudinary.com/${CLOUD_NAME}/${r.resource_type}/upload/${r.public_id}.${r.format}`;

    const tag = `[${String(i + 1).padStart(String(resources.length).length)}/${resources.length}]`;

    if (fs.existsSync(destPath)) {
      console.log(`${tag} ⏭  SKIP   ${relPath}`);
      skipped++;
    } else {
      try {
        process.stdout.write(`${tag} ⬇  ${relPath} … `);
        await downloadFile(deliveryUrl, destPath);
        const sizekb = (fs.statSync(destPath).size / 1024).toFixed(1);
        console.log(`✓ ${sizekb} KB`);
        downloaded++;
      } catch (err) {
        console.log(`✗ FAILED – ${err.message}`);
        failed++;
      }
    }

    // Write metadata sidecar (always, so it stays fresh)
    const meta = {
      public_id     : r.public_id,
      resource_type : r.resource_type,
      type          : r.type,
      format        : r.format,
      version       : r.version,
      created_at    : r.created_at,
      bytes         : r.bytes,
      width         : r.width  || null,
      height        : r.height || null,
      aspect_ratio  : r.aspect_ratio  || null,
      pixels        : r.pixels        || null,
      url           : r.url,
      secure_url    : r.secure_url,
      tags          : r.tags    || [],
      context       : r.context || {},
      etag          : r.etag    || null,
      local_path    : ('assets/cloudinary/' + relPath).replace(/\\/g, '/'),
      delivery_url  : deliveryUrl,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    masterIndex.push(meta);
  }

  // 5. Write master index.json
  const indexPath = path.join(OUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(masterIndex, null, 2));

  // 6. Summary
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`✅ Downloaded : ${downloaded}`);
  console.log(`⏭  Skipped   : ${skipped}`);
  console.log(`❌ Failed     : ${failed}`);
  console.log(`📄 Index      : ${indexPath}`);
  console.log('══════════════════════════════════════════════════════');
})();
