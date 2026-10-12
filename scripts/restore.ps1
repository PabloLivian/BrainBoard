# Script para restaurar la aplicacion oficial de Miro original
$ErrorActionPreference = "Stop"

$miroInstall = "C:\Users\Usuario\AppData\Local\Programs\RealtimeBoard"
$resourcesDir = Join-Path $miroInstall "resources"
$backupFile = Join-Path $resourcesDir "app.asar.original"
$targetAsar = Join-Path $resourcesDir "app.asar"

Write-Host "=== Restaurar Miro Original ===" -ForegroundColor Cyan

if (-not (Test-Path $backupFile)) {
    Write-Host "Error: No se encontro el archivo de backup en $backupFile" -ForegroundColor Red
    exit 1
}

$processes = Get-Process -Name "*Miro*", "*RealtimeBoard*" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "Cerrando instancias de Miro..." -ForegroundColor Yellow
    $processes | Stop-Process -Force
    Start-Sleep -Seconds 1
}

Copy-Item $backupFile $targetAsar -Force
Write-Host "Miro oficial restaurado correctamente!" -ForegroundColor Green
