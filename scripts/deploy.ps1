# Script para compilar y desplegar cambios en la instalacion local de Miro
param(
    [switch]$Launch
)

$ErrorActionPreference = "Stop"

$miroInstall = "C:\Users\Usuario\AppData\Local\Programs\RealtimeBoard"
$resourcesDir = Join-Path $miroInstall "resources"
$backupFile = Join-Path $resourcesDir "app.asar.original"
$targetAsar = Join-Path $resourcesDir "app.asar"
$targetUnpacked = Join-Path $resourcesDir "app.asar.unpacked"

Write-Host "=== Miro Desktop Custom Builder & Deployer ===" -ForegroundColor Cyan

# 1. Comprobar que Miro no este corriendo
$processes = Get-Process -Name "*Miro*", "*RealtimeBoard*" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "Cerrando instancias activas de Miro..." -ForegroundColor Yellow
    $processes | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# 2. Hacer backup del original si no existe
if (-not (Test-Path $backupFile)) {
    Write-Host "Creando copia de seguridad del ASAR original..." -ForegroundColor Green
    Copy-Item $targetAsar $backupFile
}

# 3. Empaquetar el directorio actual en un nuevo ASAR
$distDir = Join-Path $PSScriptRoot "..\dist"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

$outputAsar = Join-Path $distDir "app.asar"

Write-Host "Empaquetando codigo modificado..." -ForegroundColor Green
& npx --yes @electron/asar pack (Resolve-Path "$PSScriptRoot\..").Path $outputAsar --unpack-dir "node_modules/offline-js"

# 4. Copiar a la instalacion de Miro
Write-Host "Instalando en $resourcesDir..." -ForegroundColor Green
Copy-Item $outputAsar $targetAsar -Force
if (Test-Path "$distDir\app.asar.unpacked") {
    Copy-Item -Recurse -Force "$distDir\app.asar.unpacked\*" $targetUnpacked
}

Write-Host "Despliegue completado con exito!" -ForegroundColor Green

if ($Launch) {
    Write-Host "Iniciando Miro modificado..." -ForegroundColor Cyan
    Start-Process (Join-Path $miroInstall "Miro.exe")
}
