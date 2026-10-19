Add-Type -AssemblyName System.Drawing

$dussehraJpg = "C:\Users\sajal\.gemini\antigravity\brain\cea8949e-93e6-4448-abd7-4727bd21d0c2\icon_dussehra_1792395680315.jpg"
$diwaliJpg = "C:\Users\sajal\.gemini\antigravity\brain\cea8949e-93e6-4448-abd7-4727bd21d0c2\icon_diwali_v2_1792395722142.jpg"

function Convert-ToTruePng($sourcePath, $destPath) {
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    $img.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    Write-Host "Converted $destPath to valid PNG format"
}

# Convert Dussehra
Convert-ToTruePng $dussehraJpg "C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\mobile\assets\icon-dussehra.png"
Convert-ToTruePng $dussehraJpg "C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\mobile\assets\icon.png"
Convert-ToTruePng $dussehraJpg "C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\mobile\assets\adaptive-icon.png"
Convert-ToTruePng $dussehraJpg "C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\web\public\vedotrix-logo-dussehra.png"
Convert-ToTruePng $dussehraJpg "C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\web\public\vedotrix-logo.png"

# Convert Diwali
Convert-ToTruePng $diwaliJpg "C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\mobile\assets\icon-diwali.png"
Convert-ToTruePng $diwaliJpg "C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\web\public\vedotrix-logo-diwali.png"

Write-Host "ALL TRUE PNG CONVERSIONS COMPLETED!"
