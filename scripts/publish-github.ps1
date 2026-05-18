# Habla-Maquina-Theazec34 — publicar en GitHub
# Ejecutar en PowerShell: clic derecho → "Ejecutar con PowerShell"
# O:  Set-ExecutionPolicy -Scope Process Bypass; .\scripts\publish-github.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "Carpeta del proyecto: $ProjectRoot"

if (-not (Test-Path .git)) {
  Write-Host "Inicializando git solo en esta carpeta..."
  git init
}

Write-Host "`n=== Comprobar que .env.local está ignorado ==="
if (Test-Path .env.local) {
  git check-ignore -v .env.local
  if ($LASTEXITCODE -ne 0) {
    Write-Warning ".env.local NO está ignorado. No continúes hasta arreglar .gitignore."
    exit 1
  }
}

Write-Host "`n=== Estado antes de añadir ==="
git status --short

git add -A
Write-Host "`n=== Estado después de git add (NO debe salir .env.local) ==="
git status --short

if (git status --porcelain) {
  git commit -m @"
Initial commit: Next.js chat con Groq y métricas

Interfaz de chat, API route a Groq, panel de tokens, localStorage con validación.
"@
} else {
  Write-Host "No hay cambios nuevos que commitear."
}

git branch -M main

Write-Host "`n=== GitHub CLI ==="
gh auth status
if ($LASTEXITCODE -ne 0) {
  Write-Host "Ejecuta: gh auth login   y vuelve a lanzar este script."
  exit 1
}

$existing = ""
try { $existing = git remote get-url origin 2>$null } catch { }
if ($existing -and $existing -notmatch "Habla-Maquina-Theazec34") {
  Write-Host "Eliminando remote origin que no coincide: $existing"
  git remote remove origin
}

try { git remote get-url origin | Out-Null } catch { $_ }
if (-not (git remote get-url origin 2>$null)) {
  Write-Host "Creando repo Habla-Maquina-Theazec34 y haciendo push..."
  gh repo create Habla-Maquina-Theazec34 --public --source=. --remote=origin --push
} else {
  Write-Host "origin ya existe; push a main..."
  git push -u origin main
}

$login = gh api user -q .login
$repoUrl = "https://github.com/$login/Habla-Maquina-Theazec34"
Write-Host "`nRepo: $repoUrl" -ForegroundColor Green
