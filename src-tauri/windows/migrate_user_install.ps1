[CmdletBinding()]
param(
    [ValidateSet('Check', 'Apply')][string]$Mode = 'Check',
    [string]$InstallDirectory = (Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'MgoDesktop')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-MgoPath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'Lokasi MGO kosong.' }
    $pathValue = $Path.Trim().Trim('"')
    if ($pathValue -notmatch '^[a-zA-Z]:\\' -or $pathValue.Contains('%')) { throw "Lokasi MGO tidak didukung: $Path" }
    return [IO.Path]::GetFullPath($pathValue).TrimEnd('\')
}

function Assert-MgoNoReparse([string]$Path) {
    $cursor = Get-MgoPath $Path
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Migrasi menolak junction/symlink: $cursor"
            }
        }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
}

function Assert-MgoExecutable([string]$Path) {
    Assert-MgoNoReparse $Path
    $file = Get-Item -LiteralPath $Path
    if ($file.PSIsContainer -or $file.VersionInfo.ProductName -ne 'MgoDesktop' -or
        $file.VersionInfo.CompanyName -ne 'Viki Alvian Riyadi') {
        throw "Identitas executable tidak sesuai; tidak dihapus: $Path"
    }
}

function Get-MgoRegistryValue($Hive, [string]$Key, [string]$Name) {
    $entry = $Hive.OpenSubKey($Key)
    if (-not $entry) { return $null }
    try { return $entry.GetValue($Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) }
    finally { $entry.Dispose() }
}

function Get-MgoProfilePlan($Hive, [string]$ProfileDirectory) {
    $profile = Get-MgoPath $ProfileDirectory
    Assert-MgoNoReparse $profile
    $local = Join-Path $profile 'AppData\Local'
    $shellKey = 'Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders'
    $configuredLocal = Get-MgoRegistryValue $Hive $shellKey 'Local AppData'
    if ($configuredLocal) {
        $local = Get-MgoPath (([string]$configuredLocal) -replace '(?i)%USERPROFILE%', $profile)
    }
    # Only the exact application directory is eligible, never the profile or AppData.
    $legacy = Get-MgoPath (Join-Path $local 'MgoDesktop')
    Assert-MgoNoReparse $legacy
    $keys = @(
        'Software\Microsoft\Windows\CurrentVersion\Uninstall\MgoDesktop',
        'Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\MgoDesktop'
    )
    $registered = @()
    foreach ($key in $keys) {
        $record = $Hive.OpenSubKey($key)
        if (-not $record) { continue }
        try {
            if ($record.GetValue('DisplayName') -ne 'MgoDesktop' -or $record.GetValue('Publisher') -ne 'Viki Alvian Riyadi') {
                throw "Entri aplikasi lama tidak dikenal pada profil $profile."
            }
            $location = $record.GetValue('InstallLocation')
            if (-not $location) {
                $uninstall = [string]$record.GetValue('UninstallString')
                if ($uninstall.Trim('"') -ne (Join-Path $legacy 'uninstall.exe')) {
                    throw "Lokasi uninstaller lama perlu ditinjau pada profil $profile."
                }
                $location = $legacy
            }
            if ((Get-MgoPath $location) -ne $legacy) {
                throw "Instalasi lama di lokasi khusus perlu dimigrasikan terlebih dahulu: $location"
            }
            $registered += $key
        } finally { $record.Dispose() }
    }
    $executables = @()
    foreach ($name in @('mgo-desktop.exe', 'MgoDesktop.exe')) {
        $exe = Join-Path $legacy $name
        if (Test-Path -LiteralPath $exe) {
            Assert-MgoExecutable $exe
            # Fail before copying the new app when the legacy executable is locked.
            $stream = [IO.File]::Open($exe, 'Open', 'ReadWrite', 'None')
            $stream.Dispose()
            $executables += $exe
        }
    }
    $uninstaller = Join-Path $legacy 'uninstall.exe'
    if ((Test-Path -LiteralPath $uninstaller) -and ($executables.Count -or $registered.Count)) {
        Assert-MgoNoReparse $uninstaller
        $stream = [IO.File]::Open($uninstaller, 'Open', 'ReadWrite', 'None')
        $stream.Dispose()
    } else { $uninstaller = $null }
    $shortcutDirectories = @(
        (Join-Path $profile 'Desktop'),
        (Join-Path $profile 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs'),
        (Join-Path $profile 'AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
    )
    foreach ($name in @('Desktop', 'Programs')) {
        $location = Get-MgoRegistryValue $Hive $shellKey $name
        if ($location) {
            $location = ([string]$location) -replace '(?i)%USERPROFILE%', $profile
            $location = $location -replace '(?i)%APPDATA%', (Join-Path $profile 'AppData\Roaming')
            $shortcutDirectories += Get-MgoPath $location
        }
    }
    return [pscustomobject]@{
        Profile=$profile; Directory=$legacy; Executables=$executables; Uninstaller=$uninstaller;
        RegistryKeys=$registered; ShortcutDirectories=@($shortcutDirectories | Select-Object -Unique)
    }
}

function Get-MgoOldShortcuts($Plan) {
    $targets = @((Join-Path $Plan.Directory 'mgo-desktop.exe'), (Join-Path $Plan.Directory 'MgoDesktop.exe'), (Join-Path $Plan.Directory 'uninstall.exe'))
    $shell = New-Object -ComObject WScript.Shell
    try {
        foreach ($root in $Plan.ShortcutDirectories) {
            if (-not (Test-Path -LiteralPath $root)) { continue }
            Assert-MgoNoReparse $root
            $pending = [Collections.Generic.Stack[string]]::new()
            $pending.Push($root)
            while ($pending.Count) {
                $directory = $pending.Pop()
                Assert-MgoNoReparse $directory
                foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
                    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
                    if ($item.PSIsContainer) { $pending.Push($item.FullName); continue }
                    if ($item.Extension -ne '.lnk') { continue }
                    $link = $shell.CreateShortcut($item.FullName)
                    try {
                        if ($link.TargetPath -and $targets -contains $link.TargetPath) { $item.FullName }
                    } finally { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($link) }
                }
            }
        }
    } finally { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell) }
}

function Invoke-MgoProfileMigration($Hive, $Plan, [string]$Destination, [string]$Action) {
    $shortcuts = @(Get-MgoOldShortcuts $Plan | Select-Object -Unique)
    if ($Action -eq 'Check') { return }
    Assert-MgoExecutable (Join-Path $Destination 'mgo-desktop.exe')
    foreach ($exe in $Plan.Executables) {
        Assert-MgoExecutable $exe
        # Delete exact binaries only. Never execute a per-user uninstaller elevated,
        # and never recursively remove an application/profile directory.
        [IO.File]::Delete($exe)
    }
    if ($Plan.Uninstaller) {
        Assert-MgoNoReparse $Plan.Uninstaller
        [IO.File]::Delete($Plan.Uninstaller)
    }
    foreach ($shortcut in $shortcuts) {
        Assert-MgoNoReparse $shortcut
        [IO.File]::Delete($shortcut)
    }
    foreach ($key in $Plan.RegistryKeys) { $Hive.DeleteSubKeyTree($key, $false) }
    foreach ($vendorPath in @('Software\Viki Alvian Riyadi\MgoDesktop', 'Software\WOW6432Node\Viki Alvian Riyadi\MgoDesktop')) {
        $vendor = $Hive.OpenSubKey($vendorPath, $true)
        if ($vendor) {
            try {
                $old = $vendor.GetValue('')
                if ($old -and (Get-MgoPath $old) -eq $Plan.Directory) { $vendor.DeleteValue('', $false) }
            } finally { $vendor.Dispose() }
        }
    }
    # Preserve an existing autostart preference, pointing it at the shared app.
    $run = $Hive.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Run', $true)
    if ($run) {
        try {
            $command = [string]$run.GetValue('MgoDesktop', '')
            foreach ($name in @('mgo-desktop.exe', 'MgoDesktop.exe')) {
                $oldExe = Join-Path $Plan.Directory $name
                $pattern = '^(?:"' + [regex]::Escape($oldExe) + '"|' + [regex]::Escape($oldExe) + ')(?<args>\s.*)?$'
                if ($command -match $pattern) {
                    $run.SetValue('MgoDesktop', ('"' + (Join-Path $Destination 'mgo-desktop.exe') + '"' + $Matches['args']))
                    break
                }
            }
        } finally { $run.Dispose() }
    }
    $remaining = Get-MgoProfilePlan $Hive $Plan.Profile
    if ($remaining.Executables.Count -or $remaining.RegistryKeys.Count -or @(Get-MgoOldShortcuts $remaining).Count) {
        throw "Migrasi belum selesai untuk profil $($Plan.Profile)."
    }
    Write-Output "Migrasi selesai: $($Plan.Profile). Pengaturan dan data pengguna dipertahankan."
}

function Invoke-MgoUserInstallMigration([string]$Action, [string]$Destination) {
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) -or -not [Environment]::Is64BitProcess) {
        throw 'Migrasi memerlukan Windows PowerShell 64-bit sebagai administrator.'
    }
    $expected = Get-MgoPath (Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'MgoDesktop')
    if ((Get-MgoPath $Destination) -ne $expected) { throw 'Tujuan instalasi harus ProgramData\MgoDesktop.' }
    Assert-MgoNoReparse $Destination
    $profiles = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\*' |
        Where-Object { $_.PSChildName -match '^S-1-(5-21|12-1)-[0-9-]+$' }
    foreach ($profile in $profiles) {
        $profilePath = [Environment]::ExpandEnvironmentVariables($profile.ProfileImagePath)
        if (-not (Test-Path -LiteralPath $profilePath)) { continue }
        Assert-MgoNoReparse $profilePath
        $sid = $profile.PSChildName
        $users = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::Users, [Microsoft.Win32.RegistryView]::Registry64)
        $hive = $null
        $mount = $null
        try {
            $hive = $users.OpenSubKey($sid, ($Action -eq 'Apply'))
            if (-not $hive) {
                $file = Join-Path $profilePath 'NTUSER.DAT'
                if (-not (Test-Path -LiteralPath $file)) {
                    if (Test-Path -LiteralPath (Join-Path $profilePath 'AppData\Local\MgoDesktop')) {
                        throw "Folder MGO lama ditemukan tetapi registry profil hilang: $profilePath"
                    }
                    continue
                }
                Assert-MgoNoReparse $file
                $mount = 'MgoMigration_' + [guid]::NewGuid().ToString('N')
                & "$env:SystemRoot\System32\reg.exe" load "HKU\$mount" $file | Out-Null
                if ($LASTEXITCODE -ne 0) { $mount=$null; throw "Profil $profilePath belum dapat diperiksa. Tutup sesi pengguna lalu coba lagi." }
                $hive = $users.OpenSubKey($mount, ($Action -eq 'Apply'))
            }
            if (-not $hive) { throw "Registry profil $profilePath tidak tersedia." }
            $plan = Get-MgoProfilePlan $hive $profilePath
            Invoke-MgoProfileMigration $hive $plan $Destination $Action
        } finally {
            if ($hive) { $hive.Dispose() }
            $users.Dispose()
            if ($mount) {
                & "$env:SystemRoot\System32\reg.exe" unload "HKU\$mount" | Out-Null
                if ($LASTEXITCODE -ne 0) { throw "Registry sementara $mount belum dapat dilepas." }
            }
        }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-MgoUserInstallMigration $Mode $InstallDirectory }
    catch { Write-Error "Migrasi MGO dihentikan: $($_.Exception.Message)" -ErrorAction Continue; exit 1 }
}
