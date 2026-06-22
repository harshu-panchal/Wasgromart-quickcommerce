# Hostinger deployment — two separate Node.js apps

CORS errors from `wasgromart.com` → `api.wasgromart.com` almost always mean **the wrong app is deployed on the API subdomain**.

## Quick check

| URL | Must return |
|-----|----------------|
| `https://api.wasgromart.com/` | JSON: `{"service":"wasgro-backend-api",...}` |
| `https://api.wasgromart.com/health` | `{"ok":true,"service":"wasgro-backend-api"}` |
| `https://wasgromart.com/health` | `{"ok":true,"service":"wasgro-frontend"}` |

If `api.wasgromart.com/health` shows **`wasgro-frontend`** or returns HTML, the **frontend is deployed on the API domain** — fix hPanel (below).

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
