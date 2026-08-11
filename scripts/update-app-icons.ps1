Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Lenovo\.gemini\antigravity\brain\1d1af5da-cbbe-4bd8-8bf9-2ff6a0277b4a\.user_uploaded\media_1786419411399.jpg"
$frontendImgDir = "d:\File\HaajariManager (3)\HaajariManager\frontend\assets\images"
$adminPublicDir = "d:\File\HaajariManager (3)\HaajariManager\frontend\admin\public"
$backupDir = Join-Path $frontendImgDir "original_backup"

# 1. Create backup of original icons
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item (Join-Path $frontendImgDir "icon.png") -Destination (Join-Path $backupDir "icon.png") -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $frontendImgDir "android-icon-foreground.png") -Destination (Join-Path $backupDir "android-icon-foreground.png") -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $frontendImgDir "android-icon-background.png") -Destination (Join-Path $backupDir "android-icon-background.png") -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $frontendImgDir "splash-icon.png") -Destination (Join-Path $backupDir "splash-icon.png") -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $frontendImgDir "favicon.png") -Destination (Join-Path $backupDir "favicon.png") -ErrorAction SilentlyContinue
    Write-Host "Original icons backed up successfully to: $backupDir"
}

# 2. Function to resize and save high-quality PNG
function Save-ResizedPng($srcBitmap, $outPath, [int]$width, [int]$height) {
    $destBitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($srcBitmap, 0, 0, $width, $height)
    $graphics.Dispose()
    $destBitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Dispose()
    Write-Host "Generated: $outPath ($width by $height)"
}

$srcBitmap = [System.Drawing.Bitmap]::new($srcPath)

# 3. Generate all app & admin assets
Save-ResizedPng $srcBitmap (Join-Path $frontendImgDir "icon.png") 1024 1024
Save-ResizedPng $srcBitmap (Join-Path $frontendImgDir "android-icon-foreground.png") 1024 1024
Save-ResizedPng $srcBitmap (Join-Path $frontendImgDir "android-icon-background.png") 1024 1024
Save-ResizedPng $srcBitmap (Join-Path $frontendImgDir "splash-icon.png") 512 512
Save-ResizedPng $srcBitmap (Join-Path $frontendImgDir "favicon.png") 192 192

Save-ResizedPng $srcBitmap (Join-Path $adminPublicDir "favicon.png") 192 192
Save-ResizedPng $srcBitmap (Join-Path $adminPublicDir "icon.png") 512 512

$srcBitmap.Dispose()
Write-Host "All icon assets updated successfully!"
