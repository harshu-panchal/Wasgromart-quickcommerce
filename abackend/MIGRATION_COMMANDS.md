# Wasgromart Cloudinary → Local Storage Migration Commands

Phase 1 completed successfully (**2,919 images mapped, ~955.5 MB total**).

You can either double-click **`run-migration.bat`** inside `abackend/`, or copy and paste the commands below step by step into your terminal.

---

### Option A: One-Click Execution (Recommended)

Double-click the file:
`d:\AppZeto\wasgromart\abackend\run-migration.bat`

---

### Option B: Step-by-Step Manual Execution

Make sure you are inside `d:\AppZeto\wasgromart\abackend`:

#### Step 1: Install SFTP Client
```powershell
npm install ssh2-sftp-client --legacy-peer-deps
```

#### Step 2: Upload Images to Hostinger Server
```powershell
node src/scripts/uploadToServer.js
```
*(This will connect to Hostinger SFTP and upload all 2,919 images to `uploads/`)*

#### Step 3: Update MongoDB Image URLs (Live Mode)
```powershell
node src/scripts/migrateCloudinaryUrls.js --live
```
*(This updates all Cloudinary URLs in your database to `https://api.wasgromart.com/uploads/...`)*

#### Step 4: Verify Migration
```powershell
node src/scripts/verifyMigration.js
```
*(This scans the database to verify 0 Cloudinary URLs remain)*
