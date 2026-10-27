<#
.SYNOPSIS
  Prepara PostgreSQL local para Wave Records (idempotente: se puede ejecutar varias veces).

.DESCRIPTION
  - Pide la contraseña del superusuario 'postgres' (prompt oculto; no se guarda en ningún lado).
  - Crea o actualiza el rol 'wave_app' con una contraseña aleatoria nueva.
  - Crea las bases 'wave_records_db' (desarrollo) y 'wave_records_test' (pruebas de integración).
  - Escribe DATABASE_URL y DATABASE_URL_TEST en apps/api/.env.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/dev/setup-local-db.ps1
#>
$ErrorActionPreference = 'Stop'

$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envFile = Join-Path $repoRoot 'apps\api\.env'

if (-not (Test-Path $psql)) { throw "No se encontró psql en $psql" }
if (-not (Test-Path $envFile)) { throw "No se encontró $envFile" }

$secure = Read-Host -AsSecureString 'Contraseña del superusuario postgres'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

try {
  # Hex password: URL-safe, no escaping needed inside DATABASE_URL
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $appPassword = -join ($bytes | ForEach-Object { $_.ToString('x2') })

  function Invoke-Psql([string]$sql, [string]$db = 'postgres') {
    $out = & $psql -U postgres -h localhost -d $db -v ON_ERROR_STOP=1 -tA -c $sql 2>&1
    if ($LASTEXITCODE -ne 0) { throw "psql falló: $out" }
    return ($out | Out-String).Trim()
  }

  Invoke-Psql "select 1" | Out-Null
  Write-Host 'Conexión como postgres: OK' -ForegroundColor Green

  $roleExists = Invoke-Psql "select 1 from pg_roles where rolname = 'wave_app'"
  if ($roleExists -eq '1') {
    Invoke-Psql "alter role wave_app with login createdb password '$appPassword'" | Out-Null
    Write-Host 'Rol wave_app: ya existía, contraseña actualizada'
  } else {
    Invoke-Psql "create role wave_app with login createdb password '$appPassword'" | Out-Null
    Write-Host 'Rol wave_app: creado'
  }

  foreach ($db in @('wave_records_db', 'wave_records_test')) {
    $dbExists = Invoke-Psql "select 1 from pg_database where datname = '$db'"
    if ($dbExists -ne '1') {
      Invoke-Psql "create database $db owner wave_app" | Out-Null
      Write-Host "Base ${db}: creada"
    } else {
      Invoke-Psql "alter database $db owner to wave_app" | Out-Null
      Write-Host "Base ${db}: ya existía (dueño = wave_app)"
    }
  }

  $content = Get-Content $envFile -Raw
  $content = $content -replace '(?m)^DATABASE_URL=.*$', "DATABASE_URL=postgresql://wave_app:$appPassword@localhost:5432/wave_records_db?schema=public"
  $content = $content -replace '(?m)^DATABASE_URL_TEST=.*$', "DATABASE_URL_TEST=postgresql://wave_app:$appPassword@localhost:5432/wave_records_test?schema=public"
  Set-Content -Path $envFile -Value $content -Encoding utf8 -NoNewline

  Write-Host ''
  Write-Host 'Listo. apps/api/.env actualizado con la contraseña de wave_app.' -ForegroundColor Green
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
