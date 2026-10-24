[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RequestFile)
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator Windows required.' }
# Installed inside the sealed service-code directory. JSON is data, never script text.
& (Join-Path $PSScriptRoot 'mgo-folder-protection.exe') --activate-file $RequestFile
exit $LASTEXITCODE
