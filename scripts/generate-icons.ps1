Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\HP\.gemini\antigravity\brain\97e79d5d-fddf-4ad3-a388-1ea42ce402af\.user_uploaded\media_1794095593867_78f23008.jpg"
$resDir = "C:\Users\HP\.gemini\antigravity\scratch\glowsnake-io\android\app\src\main\res"

if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found: $srcPath"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)

# Densities for Android:
# Adaptive foreground (108dp canvas, safe zone ~64% = 69dp inner target):
# mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432
# Legacy launcher & round (48dp):
# mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192

$densities = @(
    @{ Folder = "mipmap-mdpi";    ForeSize = 108; LegacySize = 48 },
    @{ Folder = "mipmap-hdpi";    ForeSize = 162; LegacySize = 72 },
    @{ Folder = "mipmap-xhdpi";   ForeSize = 216; LegacySize = 96 },
    @{ Folder = "mipmap-xxhdpi";  ForeSize = 324; LegacySize = 144 },
    @{ Folder = "mipmap-xxxhdpi"; ForeSize = 432; LegacySize = 192 }
)

foreach ($d in $densities) {
    $targetDir = Join-Path $resDir $d.Folder
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    # 1. Generate ic_launcher_foreground.png (108dp, transparent background, safe-zone logo ~64%)
    $foreSize = $d.ForeSize
    $bmpFore = New-Object System.Drawing.Bitmap($foreSize, $foreSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gFore = [System.Drawing.Graphics]::FromImage($bmpFore)
    $gFore.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gFore.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gFore.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gFore.Clear([System.Drawing.Color]::Transparent)

    # Safe zone logo size = 64% of 108dp canvas
    $logoSize = [int][Math]::Round($foreSize * 0.64)
    $logoOffset = [int][Math]::Round(($foreSize - $logoSize) / 2)
    $gFore.DrawImage($srcImg, $logoOffset, $logoOffset, $logoSize, $logoSize)
    $gFore.Dispose()

    $forePath = Join-Path $targetDir "ic_launcher_foreground.png"
    if (Test-Path $forePath) { Remove-Item $forePath -Force }
    $bmpFore.Save($forePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpFore.Dispose()

    # 2. Generate ic_launcher.png (legacy 48dp, full canvas with dark background & logo)
    $legSize = $d.LegacySize
    $bmpLeg = New-Object System.Drawing.Bitmap($legSize, $legSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gLeg = [System.Drawing.Graphics]::FromImage($bmpLeg)
    $gLeg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gLeg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gLeg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gLeg.Clear([System.Drawing.Color]::FromArgb(255, 7, 11, 25)) # #070B19

    # Draw logo filling ~92% of the legacy icon canvas
    $legLogoSize = [int][Math]::Round($legSize * 0.92)
    $legOffset = [int][Math]::Round(($legSize - $legLogoSize) / 2)
    $gLeg.DrawImage($srcImg, $legOffset, $legOffset, $legLogoSize, $legLogoSize)
    $gLeg.Dispose()

    $legPath = Join-Path $targetDir "ic_launcher.png"
    if (Test-Path $legPath) { Remove-Item $legPath -Force }
    $bmpLeg.Save($legPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpLeg.Dispose()

    # 3. Generate ic_launcher_round.png (legacy round 48dp, circular clip)
    $bmpRound = New-Object System.Drawing.Bitmap($legSize, $legSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gRound = [System.Drawing.Graphics]::FromImage($bmpRound)
    $gRound.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gRound.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gRound.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gRound.Clear([System.Drawing.Color]::Transparent)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $legSize, $legSize)
    $gRound.SetClip($path)

    $brushBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 7, 11, 25))
    $gRound.FillEllipse($brushBg, 0, 0, $legSize, $legSize)
    $brushBg.Dispose()

    $gRound.DrawImage($srcImg, $legOffset, $legOffset, $legLogoSize, $legLogoSize)
    $path.Dispose()
    $gRound.Dispose()

    $roundPath = Join-Path $targetDir "ic_launcher_round.png"
    if (Test-Path $roundPath) { Remove-Item $roundPath -Force }
    $bmpRound.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpRound.Dispose()

    Write-Host "Generated icons for $($d.Folder): Fore=$foreSize x $foreSize, Legacy=$legSize x $legSize"
}

# 4. Generate 512x512 Play Store icon
$playStoreDir = "C:\Users\HP\OneDrive\Desktop\PlayStore_Assets"
if (Test-Path $playStoreDir) {
    $bmp512 = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g512 = [System.Drawing.Graphics]::FromImage($bmp512)
    $g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g512.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g512.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g512.Clear([System.Drawing.Color]::FromArgb(255, 7, 11, 25))
    $g512.DrawImage($srcImg, 0, 0, 512, 512)
    $g512.Dispose()

    $out512 = Join-Path $playStoreDir "icon_512.png"
    $bmp512.Save($out512, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp512.Dispose()
    Write-Host "Generated 512x512 icon at: $out512"
}

$srcImg.Dispose()
Write-Host "All icons generated successfully!"
