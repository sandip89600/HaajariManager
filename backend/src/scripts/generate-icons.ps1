Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Lenovo\.gemini\antigravity\brain\1d1af5da-cbbe-4bd8-8bf9-2ff6a0277b4a\.user_uploaded\media_1786342506557.jpg"
$destDir = "D:\File\HaajariManager (3)\HaajariManager\frontend\assets\images"
$adminPublic = "D:\File\HaajariManager (3)\HaajariManager\frontend\admin\public"

if (!(Test-Path $adminPublic)) {
    New-Item -ItemType Directory -Force -Path $adminPublic | Out-Null
}

$srcBmp = [System.Drawing.Bitmap]::new($srcPath)

function Resize-Image($src, $w, $h, $dest) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $w, $h)
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $dest ($w x $h)"
}

# 1. Main Icon 1024x1024
Resize-Image $srcBmp 1024 1024 (Join-Path $destDir "icon.png")

# 2. Android Adaptive Foreground 1024x1024
Resize-Image $srcBmp 1024 1024 (Join-Path $destDir "android-icon-foreground.png")

# 3. Android Adaptive Background 1024x1024
Resize-Image $srcBmp 1024 1024 (Join-Path $destDir "android-icon-background.png")

# 4. Splash Screen Icon 512x512
Resize-Image $srcBmp 512 512 (Join-Path $destDir "splash-icon.png")

# 5. Favicon 196x196
Resize-Image $srcBmp 196 196 (Join-Path $destDir "favicon.png")

# 6. Admin Portal Favicon & Icons
Resize-Image $srcBmp 196 196 (Join-Path $adminPublic "favicon.png")
Resize-Image $srcBmp 512 512 (Join-Path $adminPublic "icon.png")

$srcBmp.Dispose()
Write-Host "All icons generated successfully!"
