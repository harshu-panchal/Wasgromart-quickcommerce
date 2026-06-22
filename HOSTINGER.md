# Hostinger deployment — two separate Node.js apps

CORS errors from `wasgromart.com` → `api.wasgromart.com` almost always mean **the wrong app is deployed on the API subdomain**.

## ⚠️ Your live site right now (check this first)

Open in a browser:

**https://api.wasgromart.com/health**

| You see | Meaning |
|---------|---------|
| `{"ok":true,"service":"wasgro-backend-api"}` | ✅ API is correct — CORS should work |
| `{"ok":true,"service":"wasgro-frontend"}` | ❌ **Frontend is on the API domain** — fix below |
| HTML page | ❌ Wrong app or static site on API domain |

**As of last check, `api.wasgromart.com/health` returns `wasgro-frontend`.**  
No code change on the React app will fix CORS until the **backend** runs on that subdomain.

---

## Fix in Hostinger hPanel (Git deploy)

Your build logs showed this path:

`.../repository/afrontend/`

That means **Git auto-deploy for `api.wasgromart.com` is pointed at the `afrontend` folder.** It must be **`backend`**.

### Steps

1. Log in to **hPanel** → **Websites** → **api.wasgromart.com**
2. Open **Advanced** → **Git** (or **Deployments** / **Node.js**)
3. Find **Repository directory** / **Root directory** / **Install path**
4. Change from `afrontend` → **`backend`**
5. Set **Node.js** for this website:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Entry file:** `dist/server.js`
6. Add environment variables (see `backend/.env.example`): at minimum `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL=https://wasgromart.com,https://www.wasgromart.com`
7. **Deploy / Redeploy**
8. Confirm **https://api.wasgromart.com/health** → `wasgro-backend-api`

### Frontend (`wasgromart.com`) — separate website

Use a **second** website in hPanel for `wasgromart.com`:

- Git directory: **`afrontend`**
- Entry file: **`dist/server.js`**
- Or upload `afrontend/dist/` to `public_html` (static hosting, no Node)

**Do not** use `afrontend` on both domains.

---

## App 1 — API (`api.wasgromart.com`)

| Setting | Value |
|---------|--------|
| Repository folder | `backend/` |
| Build | `npm run build` |
| Start | `npm start` |
| Entry file | `dist/server.js` |

**Env vars:** `NODE_ENV=production`, `SHARED_HOSTING=true`, `MONGODB_URI=...`, `FRONTEND_URL=https://wasgromart.com,https://www.wasgromart.com`, `JWT_SECRET=...`, etc. See `backend/.env.example`.

---

## App 2 — Website (`wasgromart.com`)

| Setting | Value |
|---------|--------|
| Repository folder | `afrontend/` |
| Build | `npm run build` |
| Start | `npm start` |
| Entry file | `dist/server.js` |

**Build-time env:** `VITE_API_BASE_URL=https://api.wasgromart.com/api/v1`, `VITE_API_URL=https://api.wasgromart.com`

---

## After redeploying the API

Test CORS preflight (should include `Access-Control-Allow-Origin: https://wasgromart.com`):

```bash
curl -X OPTIONS "https://api.wasgromart.com/api/v1/header-categories" \
  -H "Origin: https://wasgromart.com" \
  -H "Access-Control-Request-Method: GET" \
  -i
```

Expect **204** or **200** with CORS headers, not **404** with HTML.

More detail: `backend/DEPLOY_UPLOADS.md`, `afrontend/DEPLOY.md`.
