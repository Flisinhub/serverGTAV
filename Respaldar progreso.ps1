[CmdletBinding(SupportsShouldProcess)]
param([string]$Restaurar)

$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $PSScriptRoot 'servidor\resources\duo'
$backupDir = Join-Path $PSScriptRoot 'respaldos'
$filePattern = '^(?:perfil|pago)-[a-z0-9._-]+\.json$'

function Get-ProgressFiles {
    param([string]$Folder)
    return Get-ChildItem -LiteralPath $Folder -File |
        Where-Object { $_.Name -match $filePattern -and !($_.Attributes -band [IO.FileAttributes]::ReparsePoint) }
}

function Write-Backup {
    param([string]$Purpose)
    $slug = (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss') + '-' + [Guid]::NewGuid().ToString().Substring(0, 8)
    $folder = Join-Path $backupDir "$Purpose-$slug"
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $files = @(Get-ProgressFiles $profileDir | ForEach-Object {
        $target = Join-Path $folder $_.Name
        Copy-Item -LiteralPath $_.FullName -Destination $target
        [ordered]@{ Name = $_.Name; SHA256 = (Get-FileHash -LiteralPath $target).Hash }
    })
    [ordered]@{ Version = 1; Files = $files } | ConvertTo-Json -Depth 4 |
        Set-Content -LiteralPath (Join-Path $folder 'manifiesto.json') -Encoding utf8
    return $folder
}

function Read-Backup {
    param([string]$Folder)
    $manifestPath = Join-Path $Folder 'manifiesto.json'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.Version -ne 1 -or $null -eq $manifest.Files) {
        throw 'Manifiesto de copia no reconocido.'
    }
    $known = @{}
    foreach ($entry in $manifest.Files) {
        if ($entry.Name -notmatch $filePattern -or $entry.SHA256 -notmatch '^[0-9a-f]{64}$' -or $known.ContainsKey($entry.Name)) {
            throw 'El manifiesto contiene un nombre, hash o duplicado no valido.'
        }
        $file = Get-Item -LiteralPath (Join-Path $Folder $entry.Name)
        if ($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            (Get-FileHash -LiteralPath $file.FullName).Hash -ne $entry.SHA256) {
            throw "No coincide el archivo de copia $($entry.Name)."
        }
        $known[$entry.Name] = $file
    }
    return $known
}

function Copy-Progress {
    param([hashtable]$Files)
    foreach ($file in $Files.Values) {
        Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $profileDir $file.Name) -Force
    }
    foreach ($file in Get-ProgressFiles $profileDir) {
        if (!$Files.ContainsKey($file.Name)) { Remove-Item -LiteralPath $file.FullName -Force }
    }
}

$serverExecutable = Join-Path $PSScriptRoot 'runtime\FXServer.exe'
$running = Get-Process -Name 'FXServer' -ErrorAction SilentlyContinue |
    Where-Object { !$_.Path -or $_.Path -eq $serverExecutable }
if ($running) {
    throw 'Deten FXServer antes de copiar o restaurar el progreso.'
}

if (!$Restaurar) {
    if ($PSCmdlet.ShouldProcess($profileDir, 'Respaldar perfiles y expedientes de pago')) {
        $snapshot = Write-Backup 'progreso'
        Write-Host "Copia guardada en $snapshot"
    }
    return
}

$folder = Get-Item -LiteralPath $Restaurar
if (!$folder.PSIsContainer -or ($folder.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    $folder.Parent.FullName -ne [IO.Path]::GetFullPath($backupDir)) {
    throw 'Selecciona una carpeta de copia directamente dentro de respaldos.'
}

$files = Read-Backup $folder.FullName
if ($PSCmdlet.ShouldProcess($profileDir, "Restaurar $($files.Count) archivos desde $($folder.FullName)")) {
    $before = Write-Backup 'antes-de-restaurar'
    Write-Host "Copia del estado anterior: $before"
    try {
        Copy-Progress $files
    } catch {
        $restoreError = $_
        Copy-Progress (Read-Backup $before)
        throw "La restauracion fallo y se repuso el estado anterior. $restoreError"
    }
    Write-Host 'Progreso restaurado.'
}

