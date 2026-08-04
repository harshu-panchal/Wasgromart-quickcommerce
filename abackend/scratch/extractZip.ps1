Add-Type -Assembly System.IO.Compression.FileSystem
$zipPath = 'd:\cloudinary.zip'
$extractPath = 'd:\AppZeto\wasgromart\uploads'

Write-Host "Extracting $zipPath to $extractPath..."
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractPath)
Write-Host "Extraction Complete!"
