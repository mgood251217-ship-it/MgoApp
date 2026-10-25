[CmdletBinding()]
param(
    [string]$RequestFile,
    [ValidateSet('Activate','ConfigureLan','FirewallOn','FirewallOff','SmbFirewallOn','SmbFirewallOff')][string]$Action = 'Activate'
)
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator Windows required.' }
# Installed inside the sealed service-code directory. JSON is data, never script text.
if ($Action -eq 'FirewallOn') {
    $rule = 'MgoFolderProtection-LAN'
    Get-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -Name $rule -DisplayName 'MGO Folder Protection - LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 42765 -RemoteAddress LocalSubnet -Profile Any -Program (Join-Path $PSScriptRoot 'mgo-folder-protection.exe') | Out-Null
    exit 0
}
if ($Action -eq 'FirewallOff') {
    Get-NetFirewallRule -Name 'MgoFolderProtection-LAN' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    exit 0
}
if ($Action -eq 'SmbFirewallOn') {
    Get-NetFirewallRule -Name 'MgoFolderProtection-SMB' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -Name 'MgoFolderProtection-SMB' -DisplayName 'MGO Folder Protection - SMB LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 445 -RemoteAddress LocalSubnet -Profile Any -Service LanmanServer | Out-Null
    exit 0
}
if ($Action -eq 'SmbFirewallOff') {
    Get-NetFirewallRule -Name 'MgoFolderProtection-SMB' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    exit 0
}
if (-not $RequestFile) { throw 'Request file required.' }
$argument = if ($Action -eq 'ConfigureLan') { '--configure-lan-file' } else { '--activate-file' }
& (Join-Path $PSScriptRoot 'mgo-folder-protection.exe') $argument $RequestFile
exit $LASTEXITCODE
