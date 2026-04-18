# Deployment Fix Script for Beit Fajjar Project

Write-Host "Starting the fix process..." -ForegroundColor Cyan

# 1. Setup Git
if (!(Test-Path .git)) {
    git init
}

# 2. Set Local Identity (Fixes "Author identity unknown")
git config user.email "mohammed@example.com"
git config user.name "Mohammed Derya"

# 3. Add Remote Origin (Force update if exists)
$remoteUrl = "https://github.com/mohammedderya/beatfajjar3.git"
git remote remove origin 2>$null
git remote add origin $remoteUrl

# 3. Pull any changes first to avoid conflicts (if needed)
# git pull origin main --rebase

# 4. Add all files (including client/server/public)
Write-Host "Adding all files for deployment..." -ForegroundColor Yellow
git add .

# 5. Commit
Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m "Full project structure fix - including client and server folders"

# 6. Push to main
Write-Host "Pushing to GitHub... This may take a minute depending on your upload speed." -ForegroundColor Green
git branch -M main
git push -u origin main --force

Write-Host "SUCCESS! Check your Render dashboard now. It should start a new build automatically." -ForegroundColor Cyan
