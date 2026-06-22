# Server-side image uploads — Hostinger deployment

Uploads are stored **outside** the Node deploy folder so `git push` never deletes user images.

## Server layout

```
~/domains/api.wasgromart.com/
├── nodejs/          ← deploy target (git pull / build)
└── uploads/         ← persistent image storage (never in git)
```

## One-time SSH setup

```bash
mkdir -p ~/domains/api.wasgromart.com/uploads
chmod 755 ~/domains/api.wasgromart.com/uploads
```

## hPanel environment variables

Set under **Websites → api.wasgromart.com → Node.js → Environment variables**:

| Variable | Value |
|----------|-------|
| `UPLOAD_DIR` | `/home/u910031778/domains/api.wasgromart.com/uploads` |
| `PUBLIC_UPLOAD_BASE_URL` | `https://api.wasgromart.com` |

If `UPLOAD_DIR` is omitted, the app defaults to `../uploads` relative to `nodejs/` (same folder as above).

Remove legacy `CLOUDINARY_*` variables — they are no longer used.

## Deploy workflow (no upload maintenance)

1. Push code → updates `nodejs/` only
2. `cd ~/domains/api.wasgromart.com/nodejs && npm install && npm run build`
3. Restart Node app from hPanel
4. Existing files in `uploads/` and MongoDB URLs keep working

## Verify after deploy

1. Upload an image via admin/seller UI or `POST /api/v1/upload/image`
2. Response `secureUrl` should start with `https://api.wasgromart.com/uploads/`
3. Open that URL in a browser — image loads
4. `ls ~/domains/api.wasgromart.com/uploads/products/` shows the new file

## Local development

Default upload dir: `backend/../uploads` (repo sibling). Files served at `http://localhost:5000/uploads/...`.

Set in `backend/.env`:

```
UPLOAD_DIR=./uploads
PUBLIC_UPLOAD_BASE_URL=http://localhost:5000
```

(Or rely on defaults — `../uploads` from `backend/` when running `npm run dev`.)
