Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "       VEDOTRIX PULSE - NATIVE ANDROID APK GENERATOR (FREE CLOUD BUILD)" -ForegroundColor Cyan
Write-Host "                 Designed & Managed by Vedotrix Technologies" -ForegroundColor Cyan
Write-Host "==============================================================================`n" -ForegroundColor Cyan

Write-Host "[*] Connected Live Supabase: https://cqevzpvyqvckvenutuzz.supabase.co" -ForegroundColor Yellow
Write-Host "[*] Features: GPS Smart Punch, Bcrypt Auth, Hierarchy Access Requests`n" -ForegroundColor Yellow

$mobileDir = $PSScriptRoot
Set-Location $mobileDir

Write-Host "------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "STEP 1: Checking Expo EAS Cloud Login Status..." -ForegroundColor White
Write-Host "------------------------------------------------------------------------------" -ForegroundColor Gray

$whoami = & npx.cmd eas whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] You are not currently logged in to Expo." -ForegroundColor Yellow
    Write-Host "[*] If you do not have a free Expo account, sign up at: https://expo.dev/signup" -ForegroundColor Cyan
    Write-Host "[*] Logging in now (please enter your Expo username/email and password):`n" -ForegroundColor White
    & npx.cmd eas login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[x] Login cancelled or failed. Please retry." -ForegroundColor Red
        return
    }
} else {
    Write-Host "[v] Logged in as: $whoami" -ForegroundColor Green
}

Write-Host "`n------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "STEP 2: Starting Free Cloud Android APK Compilation..." -ForegroundColor White
Write-Host "------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "[*] Expo will compile your native .apk on remote build servers." -ForegroundColor White
Write-Host "[*] When asked 'Would you like to automatically create an EAS project?', press Enter (Y)." -ForegroundColor Yellow
Write-Host "[*] When asked 'Generate a new Android Keystore?', press Enter (Y).`n" -ForegroundColor Yellow

& npx.cmd eas build -p android --profile preview

Write-Host "`n==============================================================================" -ForegroundColor Green
Write-Host "[*] Compilation finished! Copy the .apk download link from above." -ForegroundColor Green
Write-Host "[*] You can share this direct link or .apk file with your clients!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
