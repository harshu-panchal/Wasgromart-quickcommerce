# Cloudinary Asset Downloader - PowerShell 5.1 Compatible
# Downloads all images, raw files, and videos from Cloudinary, preserving folder structure.
# Writes a .meta.json sidecar per asset and a master index.json at the output root.

$CLOUD_NAME = "dv1l9sb4p"
$API_KEY    = "737441146281892"
$API_SECRET = "N6n7NdoFLDcEDnXPZCw8AoEC04c"
$OUT_DIR    = "$PSScriptRoot\afrontend\public\assets\cloudinary"

$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${API_KEY}:${API_SECRET}")
$authB64   = [System.Convert]::ToBase64String($authBytes)
$headers   = @{ Authorization = "Basic $authB64"; "User-Agent" = "cloudinary-downloader-ps/1.0" }

Write-Host ""
Write-Host "========================================================"
Write-Host "        Cloudinary -> Local Asset Downloader  (PS5)    "
Write-Host "========================================================"
Write-Host "Cloud : $CLOUD_NAME"
Write-Host "Output: $OUT_DIR"
Write-Host ""

New-Item -ItemType Directory -Force -Path $OUT_DIR | Out-Null

# Helper: null-safe coalesce for PS5 (no ?? operator)
function Coalesce($a, $b) {
    if ($null -ne $a -and $a -ne '') { return $a } else { return $b }
}

# Helper: call Cloudinary Admin API
function Invoke-CldApi([string]$Url) {
    $resp = Invoke-WebRequest -Uri $Url -Headers $headers -UseBasicParsing -ErrorAction Stop
    return ($resp.Content | ConvertFrom-Json)
}

# Fetch all resources (paginated) for all resource types
function Get-AllResources {
    $types     = @("image","raw","video")
    $collected = New-Object System.Collections.Generic.List[object]

    foreach ($rType in $types) {
        Write-Host "Fetching $rType resources..."
        $cursor = $null
        $page   = 1
        do {
            $url = "https://api.cloudinary.com/v1_1/$CLOUD_NAME/resources/$rType`?max_results=500"
            if ($cursor) { $url += "&next_cursor=$([uri]::EscapeDataString($cursor))" }

            try {
                $data  = Invoke-CldApi $url
                $batch = $data.resources
                Write-Host "   Page $page`: $($batch.Count) $rType(s)"
                foreach ($r in $batch) { $collected.Add($r) }
                $cursor = $data.next_cursor
            } catch {
                Write-Warning "Error fetching $rType page $page`: $_"
                $cursor = $null
            }
            $page++
        } while ($cursor)
    }
    return $collected
}

# List folders
function Get-Folders {
    try {
        $data = Invoke-CldApi "https://api.cloudinary.com/v1_1/$CLOUD_NAME/folders"
        return ($data.folders | ForEach-Object { $_.path })
    } catch {
        Write-Warning "Could not list folders: $_"
        return @()
    }
}

# Fetch resources inside a specific folder
function Get-FolderResources([string]$FolderPath) {
    $types     = @("image","raw","video")
    $collected = New-Object System.Collections.Generic.List[object]
    foreach ($rType in $types) {
        $cursor = $null
        $page   = 1
        do {
            $pfx = [uri]::EscapeDataString("$FolderPath/")
            $url = "https://api.cloudinary.com/v1_1/$CLOUD_NAME/resources/$rType`?prefix=$pfx&max_results=500"
            if ($cursor) { $url += "&next_cursor=$([uri]::EscapeDataString($cursor))" }
            try {
                $data  = Invoke-CldApi $url
                $batch = $data.resources
                if ($batch.Count -gt 0) {
                    Write-Host "   Folder '$FolderPath' / $rType page $page`: $($batch.Count) item(s)"
                    foreach ($r in $batch) { $collected.Add($r) }
                }
                $cursor = $data.next_cursor
            } catch {
                $cursor = $null
            }
            $page++
        } while ($cursor)
    }
    return $collected
}

# Safe relative path from public_id + format (PS5 compatible, no ??)
function Get-RelPath([string]$PublicId, [string]$Format) {
    $hasExt  = $PublicId -match '\.[a-zA-Z0-9]+$'
    if ($hasExt) {
        $relPath = $PublicId
    } else {
        $fmt = if ($Format -ne $null -and $Format -ne '') { $Format } else { 'bin' }
        $relPath = "$PublicId.$fmt"
    }
    # Replace characters invalid on Windows
    return ($relPath -replace '[<>:"|?*\x00]','_')
}

# ─── Main ─────────────────────────────────────────────────────────────────────

$resources = Get-AllResources

$folders = Get-Folders
if ($folders.Count -gt 0) {
    Write-Host ""
    Write-Host "Found $($folders.Count) folder(s): $($folders -join ', ')"
    foreach ($folder in $folders) {
        $extra = Get-FolderResources $folder
        foreach ($r in $extra) { $resources.Add($r) }
    }
}

# Deduplicate by public_id
$seen   = New-Object System.Collections.Generic.HashSet[string]
$unique = New-Object System.Collections.Generic.List[object]
foreach ($r in $resources) {
    if ($seen.Add($r.public_id)) { $unique.Add($r) }
}

Write-Host ""
Write-Host "Total unique assets: $($unique.Count)"

if ($unique.Count -eq 0) { Write-Host "Nothing to download."; exit 0 }

$downloaded = 0
$skipped    = 0
$failed     = 0
$masterIdx  = New-Object System.Collections.Generic.List[object]
$total      = $unique.Count

for ($i = 0; $i -lt $total; $i++) {
    $r       = $unique[$i]
    $fmt     = if ($r.format -ne $null -and $r.format -ne '') { $r.format } else { 'bin' }
    $relPath = Get-RelPath $r.public_id $fmt
    $dest    = Join-Path $OUT_DIR $relPath
    $metaOut = "$dest.meta.json"

    if ($r.secure_url -ne $null -and $r.secure_url -ne '') {
        $dlUrl = $r.secure_url
    } else {
        $dlUrl = "https://res.cloudinary.com/$CLOUD_NAME/$($r.resource_type)/upload/$($r.public_id).$fmt"
    }

    $tag = "[{0}/{1}]" -f ($i+1), $total

    # Build metadata object
    $meta = [PSCustomObject]@{
        public_id     = $r.public_id
        resource_type = $r.resource_type
        type          = $r.type
        format        = $r.format
        version       = $r.version
        created_at    = $r.created_at
        bytes         = $r.bytes
        width         = $r.width
        height        = $r.height
        aspect_ratio  = $r.aspect_ratio
        pixels        = $r.pixels
        url           = $r.url
        secure_url    = $r.secure_url
        tags          = $r.tags
        context       = $r.context
        etag          = $r.etag
        local_path    = ("assets/cloudinary/" + $relPath.Replace("\","/"))
        delivery_url  = $dlUrl
    }

    # Write sidecar metadata
    $dir = Split-Path $dest -Parent
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $meta | ConvertTo-Json -Depth 10 | Set-Content -Path $metaOut -Encoding UTF8

    $masterIdx.Add($meta)

    if (Test-Path $dest) {
        Write-Host "$tag SKIP  $relPath"
        $skipped++
    } else {
        Write-Host -NoNewline "$tag DOWN  $relPath ... "
        try {
            Invoke-WebRequest -Uri $dlUrl -OutFile $dest -UseBasicParsing -ErrorAction Stop
            $sizeKB = [math]::Round((Get-Item $dest).Length / 1KB, 1)
            Write-Host "OK ($sizeKB KB)"
            $downloaded++
        } catch {
            Write-Host "FAILED - $_"
            $failed++
        }
    }
}

# Write master index
$indexPath = Join-Path $OUT_DIR "index.json"
$masterIdx | ConvertTo-Json -Depth 10 | Set-Content -Path $indexPath -Encoding UTF8

Write-Host ""
Write-Host "========================================================"
Write-Host "Downloaded : $downloaded"
Write-Host "Skipped    : $skipped"
Write-Host "Failed     : $failed"
Write-Host "Index      : $indexPath"
Write-Host "========================================================"
