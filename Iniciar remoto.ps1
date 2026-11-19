param([switch]$Registrar)

$ErrorActionPreference = 'Stop'

function Test-TailscaleIPv4 {
    param([string]$Address)
    if ($Address -notmatch '^100\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$') { return $false }
    return [int]$Matches[1] -ge 64 -and [int]$Matches[1] -le 127 -and
        [int]$Matches[2] -le 255 -and [int]$Matches[3] -le 255
}

function Get-TailscaleCli {
    $cmd = Get-Command tailscale.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
    $default = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (Test-Path -LiteralPath $default -PathType Leaf) { return $default }
    throw 'Instala Tailscale en el anfitrion, inicia sesion y conecta la VPN.'
}

$serverDir = Join-Path $PSScriptRoot 'servidor'
$fxServer = Join-Path $PSScriptRoot 'runtime\FXServer.exe'
$license = Join-Path $serverDir 'licencia.cfg'
$players = Join-Path $serverDir 'jugadores.cfg'
$idFormat = '^license:[0-9a-f]{40}$'

if (!(Test-Path -LiteralPath $fxServer -PathType Leaf)) { throw 'Falta runtime\FXServer.exe.' }

$tailscale = Get-TailscaleCli
$localAddress = ([string](& $tailscale ip -4 | Select-Object -First 1)).Trim()
if ($LASTEXITCODE -ne 0 -or !(Test-TailscaleIPv4 $localAddress)) {
    throw 'Tailscale no tiene una IPv4 activa. Conecta la VPN en este equipo.'
}

if (!(Test-Path -LiteralPath $license -PathType Leaf)) {
    & (Join-Path $PSScriptRoot 'Configurar licencia.ps1')
    if (!(Test-Path -LiteralPath $license -PathType Leaf)) { throw 'Falta la clave de servidor de Cfx.re.' }
}

$launch = @(
    '+set', 'sv_lan', 'false',
    '+endpoint_add_tcp', '127.0.0.1:30120',
    '+endpoint_add_udp', '127.0.0.1:30120',
    '+endpoint_add_tcp', "${localAddress}:30120",
    '+endpoint_add_udp', "${localAddress}:30120"
)

if ($Registrar) {
    $peer = (Read-Host 'IPv4 de Tailscale del segundo jugador tal como aparece en el equipo anfitrion').Trim()
    if (!(Test-TailscaleIPv4 $peer) -or $peer -eq $localAddress) {
        throw 'Introduce la IPv4 de Tailscale del otro jugador.'
    }
    $launch += @('+set', 'duo_enroll_peer', $peer, '+set', 'duo_require_allowlist', '0')
    Write-Host 'Registro temporal. Conectaos ambos y ejecuta duo_identificadores en la consola del servidor.'
    Write-Host 'Cierra el servidor de registro al tener ambas licencias y abre Iniciar remoto.cmd normalmente.'
} else {
    if (!(Test-Path -LiteralPath $players -PathType Leaf)) {
        $first = (Read-Host 'Licencia de FiveM del anfitrion (license:...)').Trim().ToLowerInvariant()
        $second = (Read-Host 'Licencia de FiveM del segundo jugador (license:...)').Trim().ToLowerInvariant()
        if ($first -notmatch $idFormat -or $second -notmatch $idFormat -or $first -eq $second) {
            throw 'Se requieren dos identificadores de FiveM distintos con prefijo license: y 40 caracteres hexadecimales.'
        }
        Set-Content -LiteralPath $players -Value ('set duo_allowlist "' + $first + ',' + $second + '"') -Encoding Ascii
    }
    $settings = (Get-Content -LiteralPath $players -Raw).Trim()
    if ($settings -notmatch '^set duo_allowlist "(license:[0-9a-f]{40}),(license:[0-9a-f]{40})"$' -or
        $Matches[1] -eq $Matches[2]) {
        throw 'Corrige servidor\jugadores.cfg: se requieren dos identificadores distintos en una sola linea.'
    }
    $launch += @('+exec', 'jugadores.cfg', '+set', 'duo_require_allowlist', '1')
}

Write-Host 'Anfitrion en F8: connect 127.0.0.1:30120'
Write-Host "Segundo jugador en F8: connect ${localAddress}:30120 (usa la IP que ve su Tailscale)"
Push-Location -LiteralPath $serverDir
try {
    & $fxServer @launch '+exec' 'remoto.cfg'
    if ($LASTEXITCODE -ne 0) { throw "FXServer termino con codigo $LASTEXITCODE." }
} finally {
    Pop-Location
}

