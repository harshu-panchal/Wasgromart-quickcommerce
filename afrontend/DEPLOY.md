# Frontend deployment — Hostinger

This is a **Vite + React SPA**. The build outputs static files to `dist/` (`index.html` + assets). It is **not** a backend API.

| App | Folder | Entry file | Start |
|-----|--------|------------|-------|
| **API (Express + Socket.IO)** | `backend/` | `dist/server.js` | `npm start` |
| **Website (React SPA)** | `afrontend/` | **`server.js`** | `npm start` |

Do **not** set the frontend Entry file to `dist/server.js` — that file does not exist for this app.

## Hostinger Node.js (frontend domain, e.g. wasgromart.com)

1. **Application root:** `afrontend` (or repo path ending in `/afrontend`)
2. **Build command:** `npm run build`
3. **Start command:** `npm start`
4. **Entry file:** `server.js` ← root of `afrontend/`, not `dist/`

`server.js` is a small Express app that serves `dist/` and falls back to `index.html` for React Router.

## Environment variables (build time)

Set before build so API URLs are baked into the bundle (see `.env.production`):

```env
VITE_API_BASE_URL=https://api.wasgromart.com/api/v1
VITE_API_URL=https://api.wasgromart.com
```

## Alternative: static hosting (no Node)

If your plan supports serving `public_html` only:

1. Run `npm run build` locally or in CI
2. Upload contents of `afrontend/dist/` to `public_html`
3. Ensure `.htaccess` is present (copied from `public/.htaccess` by Vite build) for SPA routing

No `server.js` needed for pure static hosting.

## Backend API

Deploy separately under `api.wasgromart.com` from the `backend/` folder. See `backend/DEPLOY_UPLOADS.md`.
