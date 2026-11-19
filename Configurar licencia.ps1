$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot 'servidor\licencia.cfg'
Write-Host 'Genera una clave de servidor gratis en https://portal.cfx.re/servers/registration-keys'
$secureKey = Read-Host 'Pega la clave de registro de Cfx.re (entrada oculta)' -AsSecureString
$key = [System.Net.NetworkCredential]::new('', $secureKey).Password.Trim()
if ($key -notmatch '^[a-zA-Z0-9_-]{12,128}$') {
    Write-Error 'La clave no tiene un formato valido.'
    exit 1
}
Set-Content -LiteralPath $target -Value ('sv_licenseKey "' + $key + '"') -Encoding Ascii
Write-Host 'Clave guardada en servidor\licencia.cfg'
