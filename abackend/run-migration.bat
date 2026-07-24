@echo off
echo ===================================================
echo   Wasgromart Cloudinary to Local Server Migration
echo ===================================================
echo.

echo Step 1: Building image mapping...
node src\scripts\buildCloudinaryMap.js
if %errorlevel% neq 0 (
    echo Error in Step 1! Stopping.
    pause
    exit /b %errorlevel%
)
echo.

echo Step 2: Installing SFTP dependency...
call npm install ssh2-sftp-client --legacy-peer-deps
echo.

echo Step 3: Uploading images to Hostinger server via SFTP...
node src\scripts\uploadToServer.js
if %errorlevel% neq 0 (
    echo Error in Step 3! Stopping.
    pause
    exit /b %errorlevel%
)
echo.

echo Step 4: Migrating MongoDB URLs (Live mode)...
node src\scripts\migrateCloudinaryUrls.js --live
if %errorlevel% neq 0 (
    echo Error in Step 4! Stopping.
    pause
    exit /b %errorlevel%
)
echo.

echo Step 5: Verifying migration results...
node src\scripts\verifyMigration.js
echo.
echo ===================================================
echo   Migration Complete!
echo ===================================================
pause
