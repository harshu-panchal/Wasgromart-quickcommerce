# Hostinger deployment — fix CORS / API not loading

## Symptom

Browser console on `https://wasgromart.com`:

```
Access to XMLHttpRequest at 'https://api.wasgromart.com/api/v1/...' from origin 'https://wasgromart.com'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

Often paired with `net::ERR_FAILED 200 (OK)` — the HTTP status is 200, but the body is **HTML**, not JSON.

## Root cause

`api.wasgromart.com` is serving the **frontend SPA** (`index.html` + `.htaccess` SPA fallback), not the Node.js backend.

Quick check from your machine:

```bash
curl -s https://api.wasgromart.com/ | head -5
```

- **Broken:** HTML with `<title>Wasgro Mart` — frontend is on the API domain.
- **Fixed:** JSON like `{"message":"Kosil API Server is running!",...}`.

```bash
curl -sI -H "Origin: https://wasgromart.com" https://api.wasgromart.com/api/v1/header-categories
```

- **Fixed:** includes `Access-Control-Allow-Origin: https://wasgromart.com`.

The backend CORS config in `src/server.ts` already allows `https://wasgromart.com`. CORS only fails because requests never reach Express.

## Correct layout

```
~/domains/wasgromart.com/public_html/     ← frontend dist only (index.html, assets/, .htaccess SPA)
~/domains/api.wasgromart.com/
├── nodejs/                               ← backend deploy (git pull, npm run build)
└── uploads/                              ← persistent images (see DEPLOY_UPLOADS.md)
```

`api.wasgromart.com/public_html/` must **not** contain frontend files or the SPA `.htaccess`.

## Fix (SSH + hPanel)

### 1. Clean the API subdomain document root

```bash
ssh -p 65002 u910031778@147.93.99.211

# List what is wrongly deployed on the API domain
ls -la ~/domains/api.wasgromart.com/public_html/

# Remove frontend SPA files if present (keep the folder, remove contents)
rm -f ~/domains/api.wasgromart.com/public_html/index.html
rm -f ~/domains/api.wasgromart.com/public_html/.htaccess
rm -rf ~/domains/api.wasgromart.com/public_html/assets
```

### 2. Deploy / update the Node backend

```bash
cd ~/domains/api.wasgromart.com/nodejs
git pull
npm install
npm run build
```

### 3. hPanel → Websites → api.wasgromart.com → Node.js

- Application root: `domains/api.wasgromart.com/nodejs`
- Entry file: `dist/server.js` (or `server.js` per your hPanel setting)
- **Restart** the Node application

### 4. Required environment variables (api.wasgromart.com Node.js)

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas connection string |
| `FRONTEND_URL` | `https://wasgromart.com` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | (from your secrets) |
| `UPLOAD_DIR` | `/home/u910031778/domains/api.wasgromart.com/uploads` |
| `PUBLIC_UPLOAD_BASE_URL` | `https://api.wasgromart.com` |
| `FIREBASE_SERVICE_ACCOUNT` | one-line JSON (see `.env.example`) |

Do **not** set `FRONTEND_URL` to `http://localhost:5173/` in production.

### 5. Verify

```bash
curl -s https://api.wasgromart.com/
curl -s https://api.wasgromart.com/api/v1/header-categories | head -c 200
curl -sI -H "Origin: https://wasgromart.com" https://api.wasgromart.com/api/v1/header-categories
```

Then hard-refresh `https://wasgromart.com` (Ctrl+Shift+R).

## Frontend domain (`wasgromart.com`)

- Deploy **only** `afrontend/dist/` to `~/domains/wasgromart.com/public_html/`.
- Production build uses `VITE_API_BASE_URL=https://api.wasgromart.com/api/v1` (see `afrontend/.env.production`).
- Do **not** copy the frontend build into `api.wasgromart.com/public_html/`.

## Common mistakes

| Mistake | Result |
|---------|--------|
| Frontend `dist/` uploaded to `api.wasgromart.com/public_html/` | API returns HTML → CORS errors |
| `api.wasgromart.com` aliased to same docroot as `wasgromart.com` | Same issue |
| Node app not restarted after deploy | Stale or down backend |
| `FRONTEND_URL` still `localhost` in production | CORS may reject browser requests |

## Separate issue: manifest icon

If you see `logo192.png (Download error or resource isn't a valid image)`, add a valid `logo192.png` under `afrontend/public/` and rebuild the frontend.
