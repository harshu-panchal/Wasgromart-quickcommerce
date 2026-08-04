Add-Type -Assembly System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('d:\cloudinary.zip')
$zip.Entries | ForEach-Object { $_.FullName } | Out-File -FilePath 'scratch\zip-entries.txt' -Encoding utf8
