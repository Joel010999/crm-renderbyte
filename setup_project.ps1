$ErrorActionPreference = "Stop"
$tempDir = "$env:TEMP\renderbyte-crm-build"
$targetDir = "G:\Mi unidad\ClientMagnet Web\CRM RENDER BYTE\renderbyte-crm"

Write-Host "Cleaning temp directory: $tempDir"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Force -Path $tempDir

Write-Host "Creating Next.js app in temp directory..."
# Create the app directly in the temp dir
npx -y create-next-app@latest $tempDir --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack

Set-Location $tempDir

Write-Host "Installing additional dependencies..."
npm install next-auth bcrypt zod recharts lucide-react framer-motion clsx tailwind-merge class-variance-authority react-hook-form @hookform/resolvers @prisma/client date-fns
npm install -D prisma @types/bcrypt

Write-Host "Copying project to target: $targetDir"
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir }
Copy-Item -Path "$tempDir\*" -Destination $targetDir -Recurse -Force

Write-Host "Done! Project setup complete."
