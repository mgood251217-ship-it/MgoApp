[CmdletBinding()]
param(
    [ValidateSet('Plan', 'Install', 'Upgrade', 'RecoverTestRoot', 'RecoverDeletedState')]
    [string]$Mode = 'Plan',
    [ValidateSet('PrivateSandbox', 'DriveD')]
    [string]$TestLocation = 'PrivateSandbox',
    [string]$AuthorizedSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value,
    [string]$AuthorizedAccount = ''
)

# Plan is read-only. Install must be explicitly approved and run as administrator.
# Only fresh, fixed test/service directories are accepted; existing data is never adopted.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not [Environment]::Is64BitProcess) { throw 'Run this script in 64-bit PowerShell.' }

$serviceName = 'MgoFolderProtection'
$serviceAccount = 'NT SERVICE\MgoFolderProtection'
$projectTauri = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceBinary = Join-Path $PSScriptRoot 'mgo-folder-protection.exe'
if (-not (Test-Path -LiteralPath $sourceBinary -PathType Leaf)) { $sourceBinary = Join-Path $projectTauri 'target\release\mgo-folder-protection.exe' }
$programFilesBase = [Environment]::GetFolderPath('ProgramFiles')
$programDataBase = [Environment]::GetFolderPath('CommonApplicationData')
$installDirectory = Join-Path $programFilesBase 'MgoFolderProtection'
$stateDirectory = Join-Path $programDataBase 'MgoFolderProtection'
$testParent = Join-Path $programDataBase 'MgoFolderProtectionTest'
$testRoot = if ($TestLocation -eq 'DriveD') { 'D:\MGO-Test' } else { Join-Path $testParent 'MGO-Test' }
$configPath = Join-Path $stateDirectory 'service.json'
$installedBinary = Join-Path $installDirectory 'mgo-folder-protection.exe'
$registryPath = 'HKLM:\SOFTWARE\MGO\FolderProtection'
if ($AuthorizedAccount) {
    if ($AuthorizedAccount -match '["\r\n\x00]') { throw 'Invalid Windows account name.' }
    $AuthorizedSid = ([Security.Principal.NTAccount]::new($AuthorizedAccount)).Translate([Security.Principal.SecurityIdentifier]).Value
}
$authorizedIdentity = [Security.Principal.SecurityIdentifier]::new($AuthorizedSid)

function Assert-NoReparseAncestor([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Reparse point rejected: $cursor"
            }
        }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
}

function Invoke-ServiceControl([string[]]$Arguments) {
    # Windows PowerShell's legacy native argument binder strips embedded quotes.
    # Preserve the quoted ImagePath; never let a path containing spaces become unquoted.
    $nativeArguments = $Arguments
    $nativeMode = Get-Variable -Name PSNativeCommandArgumentPassing -ValueOnly -ErrorAction SilentlyContinue
    if ($PSVersionTable.PSEdition -eq 'Desktop' -or $PSVersionTable.PSVersion -lt [version]'7.3' -or $nativeMode -eq 'Legacy') {
        $nativeArguments = @($Arguments | ForEach-Object { $_.Replace('"', '\"') })
    }
    $output = & "$env:SystemRoot\System32\sc.exe" @nativeArguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Service Control failed: $($output -join ' ')" }
    $output
}

function Publish-RootRegistration($Configuration, [string]$Sid) {
    $registration = [Microsoft.Win32.Registry]::LocalMachine.CreateSubKey('SOFTWARE\MGO\FolderProtection', $true)
    try {
        $registration.SetValue('ServerSid', $Sid, [Microsoft.Win32.RegistryValueKind]::String)
        if ($Configuration.PSObject.Properties['roots']) {
            $first=$Configuration.roots[0]
            $registration.SetValue('RootPath', [string]$first.path, [Microsoft.Win32.RegistryValueKind]::String)
            $registration.SetValue('RootAliases', (ConvertTo-Json -InputObject @($first.aliases) -Compress), [Microsoft.Win32.RegistryValueKind]::String)
            $routes=@($Configuration.roots | ForEach-Object { @{ root_id=$_.id;aliases=@([string]$_.path)+@($_.aliases) } })
            $registration.SetValue('Roots',(ConvertTo-Json -InputObject $routes -Depth 5 -Compress),[Microsoft.Win32.RegistryValueKind]::String)
        } else {
            $registration.SetValue('RootPath', [string]$Configuration.root, [Microsoft.Win32.RegistryValueKind]::String)
            $aliases = @()
            if ($Configuration.PSObject.Properties['aliases']) { $aliases = @($Configuration.aliases) }
            $registration.SetValue('RootAliases', (ConvertTo-Json -InputObject $aliases -Compress), [Microsoft.Win32.RegistryValueKind]::String)
            $registration.DeleteValue('Roots', $false)
        }
        $registration.SetValue('ProtocolVersion', 4, [Microsoft.Win32.RegistryValueKind]::DWord)
    } finally { $registration.Dispose() }
}

function Install-TrustedActivationLauncher {
    $source=Join-Path $PSScriptRoot 'activate_folder_protection.ps1'
    $destination=Join-Path $installDirectory 'activate_folder_protection.ps1'
    if ([IO.Path]::GetFullPath($source) -eq [IO.Path]::GetFullPath($destination)) { return }
    Assert-NoReparseAncestor $source
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Activation launcher missing from this package.' }
    $next=Join-Path $installDirectory 'activate_folder_protection.next.ps1'
    $stream=[IO.File]::Open($source,'Open','Read','Read')
    try { $output=[IO.File]::Open($next,'CreateNew','Write','None');try{$stream.CopyTo($output);$output.Flush($true)}finally{$output.Dispose()} }finally{$stream.Dispose()}
    if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $next).Hash) { throw 'Launcher hash mismatch.' }
    # Windows PowerShell 5.1 converts $null to an empty string for .NET string
    # arguments. File.Replace requires a real null when no backup is requested.
    if (Test-Path -LiteralPath $destination) { [IO.File]::Replace($next,$destination,[NullString]::Value) } else { [IO.File]::Move($next,$destination) }
}

function Set-FreshDirectoryPermissions([string]$Path, [string]$ServiceRights, [bool]$AllowReaders) {
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
    $acl.SetAccessRuleProtection($true, $false)
    $inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    foreach ($entry in @(@('S-1-5-18', 'FullControl'), @('S-1-5-32-544', 'FullControl'), @($serviceSid, $ServiceRights))) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            [Security.Principal.SecurityIdentifier]::new($entry[0]),
            [Security.AccessControl.FileSystemRights]$entry[1], $inherit,
            [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    if ($AllowReaders) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            [Security.Principal.SecurityIdentifier]::new('S-1-5-11'),
            [Security.AccessControl.FileSystemRights]::ReadAndExecute, $inherit,
            [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow))
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
    if ((Get-Acl -LiteralPath $Path).GetOwner([Security.Principal.SecurityIdentifier]).Value -ne 'S-1-5-32-544') {
        throw "Directory owner verification failed: $Path"
    }
}


function Assert-ServiceReady {
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    $lastFailure = 'Service has not responded.'
    do {
        if ((Get-Service -Name $serviceName).Status -ne 'Running') {
            throw 'Layanan berhenti sebelum siap. Periksa folder terdaftar dan Event Viewer > Application > MgoFolderProtection.'
        }
        try {
            $reply = (& $sourceBinary --check-service 2>&1 | Out-String)
            if ($LASTEXITCODE -eq 0) { return }
            $lastFailure = $reply.Trim()
        } catch { $lastFailure = $_.Exception.Message }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Layanan belum siap menerima operasi: $lastFailure"
}

# Upgrade only replaces the already-registered service executable. It preserves root,
# users, aliases, ACLs, snapshots and audit records. It never adopts another service.
if (-not (Test-Path -LiteralPath $sourceBinary -PathType Leaf)) { throw 'The service executable is missing from this package.' }
Assert-NoReparseAncestor $sourceBinary
$existingService = Get-CimInstance Win32_Service -Filter "Name='MgoFolderProtection'"
if ($existingService -and $Mode -in @('RecoverTestRoot', 'RecoverDeletedState')) {
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Test-root recovery requires explicit administrator approval.' }
    $expectedImage = '"' + $installedBinary + '" --service "' + $configPath + '"'
    if ($existingService.StartName -ne $serviceAccount -or $existingService.PathName -ne $expectedImage) { throw 'Foreign service rejected.' }
    if ($existingService.State -ne 'Stopped') { throw 'Recovery accepts only a stopped service.' }
    Assert-NoReparseAncestor $installDirectory
    if (-not (Test-Path -LiteralPath $installedBinary -PathType Leaf)) { throw 'Managed service executable is missing; code installation requires separate review.' }
    Assert-NoReparseAncestor $configPath
    $expectedRoot = Join-Path $testParent 'MGO-Test'
    $rebuildState = $Mode -eq 'RecoverDeletedState'
    if ($rebuildState) {
        if (-not ($PSBoundParameters.ContainsKey('AuthorizedSid') -or $PSBoundParameters.ContainsKey('AuthorizedAccount'))) { throw 'Deleted-state recovery requires an explicit Windows operator account/SID.' }
        if (Test-Path -LiteralPath $stateDirectory) { throw 'Deleted-state recovery refuses to overwrite existing state.' }
        $configuration = [pscustomobject]@{root=$expectedRoot;state_directory=$stateDirectory;users=@(@{sid=$AuthorizedSid;write=$true});aliases=@()}
    } else {
        $configuration = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    }
    if ([string]$configuration.root -ne $expectedRoot -or [string]$configuration.state_directory -ne $stateDirectory) { throw 'Recovery is restricted to the fixed ProgramData test root and private state.' }
    Assert-NoReparseAncestor $expectedRoot
    if ((Test-Path -LiteralPath $testParent) -or (Test-Path -LiteralPath $expectedRoot)) { throw 'Recovery refuses to adopt or overwrite existing test directories.' }
    $volume = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($expectedRoot))
    if ($volume.DriveFormat -ne 'NTFS' -or $volume.DriveType -ne 'Fixed') { throw 'Recovery requires a local fixed NTFS volume.' }
    $parentAcl = Get-Acl -LiteralPath $programDataBase
    if ($parentAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18','S-1-5-32-544')) { throw 'ProgramData parent owner requires review.' }
    foreach ($ace in $parentAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
        if ($ace.AccessControlType -eq 'Allow' -and -not ($ace.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -and ([int]$ace.FileSystemRights -band 0x000D0040) -and $ace.IdentityReference.Value -notin @('S-1-5-18','S-1-5-32-544')) { throw 'Unsafe ProgramData parent permissions; recovery stopped.' }
    }
    $serviceSid = ([Security.Principal.NTAccount]::new($serviceAccount)).Translate([Security.Principal.SecurityIdentifier]).Value
    if ($serviceSid -ne (Get-ItemProperty -LiteralPath $registryPath -Name ServerSid).ServerSid) { throw 'Service SID mismatch.' }
    $backup = Join-Path $stateDirectory 'original-acl.json'
    $oldSnapshot = $null
    if (-not $rebuildState) {
        if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) { throw 'Prior recovery snapshot is missing; manual review required.' }
        $oldSnapshot = Get-Content -LiteralPath $backup -Raw | ConvertFrom-Json
        if ([string]$oldSnapshot.root -ne ('\\?\' + $expectedRoot) -and [string]$oldSnapshot.root -ne $expectedRoot) { throw 'Prior snapshot refers to another root.' }
    }
    $recoveryId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N')
    $archived = Join-Path $stateDirectory ('original-acl.retired-' + $recoveryId + '.json')
    $journal = Join-Path $stateDirectory ('test-root-recovery-' + $recoveryId + '.json')
    if ($rebuildState) {
        New-Item -ItemType Directory -Path $stateDirectory | Out-Null
        Set-FreshDirectoryPermissions $stateDirectory 'Modify' $false
        [IO.File]::WriteAllText($configPath, ($configuration | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
    }
    $oldFileId = if ($null -ne $oldSnapshot) { $oldSnapshot.file_id } else { $null }
    [IO.File]::WriteAllText($journal, ([ordered]@{ action=$Mode; root=$expectedRoot; retired_snapshot=if($rebuildState){$null}else{$archived}; old_file_id=$oldFileId; previous_state_missing=$rebuildState; original_data_restored=$false; approved_by=[Security.Principal.WindowsIdentity]::GetCurrent().Name } | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    # Create only new directories. No existing data or directory ACL is rewritten.
    New-Item -ItemType Directory -Path $testParent | Out-Null
    Set-FreshDirectoryPermissions $testParent 'ReadAndExecute' $true
    New-Item -ItemType Directory -Path $expectedRoot | Out-Null
    $before = Join-Path $stateDirectory ('setup-acl-before-recovery-' + $recoveryId + '.json')
    [IO.File]::WriteAllText($before, (@{root=$expectedRoot;sddl_owner_group_dacl=(Get-Acl -LiteralPath $expectedRoot).Sddl} | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    Set-FreshDirectoryPermissions $expectedRoot 'Modify' $true
    # Preserve the deleted directory's identity record. The broker creates a separate
    # snapshot for the new directory only after the old record has been archived.
    if (-not $rebuildState) { [IO.File]::Move($backup, $archived) }
    & $PSCommandPath -Mode Upgrade
    if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) { throw 'New root snapshot was not created; review the recovery journal.' }
    [pscustomobject]@{ recovered_test_root=$expectedRoot; retired_snapshot=if($rebuildState){$null}else{$archived}; data_restored=$false; user_grants_preserved=(-not $rebuildState); enrolled_user_sid=$AuthorizedSid } | ConvertTo-Json
    return
}
if ($Mode -in @('RecoverTestRoot', 'RecoverDeletedState')) { throw 'No managed test service exists to recover.' }
if ($existingService -and $Mode -in @('Plan', 'Upgrade')) {
    $expectedImage = '"' + $installedBinary + '" --service "' + $configPath + '"'
    if ($existingService.StartName -ne $serviceAccount -or $existingService.PathName -ne $expectedImage) {
        throw 'Existing service identity or executable path differs from the managed setup; manual review required.'
    }
    if ($Mode -eq 'Plan') {
        [pscustomobject]@{ mode = 'Plan'; action = 'Upgrade'; service = $serviceName; executable = $installedBinary; configuration = $configPath;
            source_sha256 = (Get-FileHash -LiteralPath $sourceBinary -Algorithm SHA256).Hash;
            changes = 'Stop service, stage verified binary, replace executable with rollback backup, publish root routing metadata, restart service';
            preserved = 'Configured root, user grants, aliases, ACLs, data, recovery snapshots and audit records' } | ConvertTo-Json
        return
    }
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Service upgrade requires Administrator.' }
    Assert-NoReparseAncestor $installDirectory
    Assert-NoReparseAncestor $configPath
    $configuration = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if (-not $configuration.PSObject.Properties['roots']) {
        if ([IO.Path]::GetFileName([string]$configuration.root) -ne 'MGO-Test') { throw 'Legacy root is not the managed test root.' }
        Assert-NoReparseAncestor ([string]$configuration.root)
    } elseif ($configuration.schema -ne 4 -or @($configuration.roots).Count -lt 1 -or @($configuration.roots).Count -gt 32) { throw 'Invalid root catalog.' }
    # Missing data roots are reported separately by protocol 4; never recreated by an upgrade.
    $expectedSid = ([Security.Principal.NTAccount]::new($serviceAccount)).Translate([Security.Principal.SecurityIdentifier]).Value
    $registeredSid = (Get-ItemProperty -LiteralPath $registryPath -Name ServerSid).ServerSid
    if ($expectedSid -ne $registeredSid) { throw 'Registered service SID mismatch.' }
    $stagedBinary = Join-Path $installDirectory 'mgo-folder-protection.next.exe'
    $backupBinary = Join-Path $installDirectory 'mgo-folder-protection.previous.exe'
    if ((Test-Path -LiteralPath $stagedBinary) -or (Test-Path -LiteralPath $backupBinary)) { throw 'A previous incomplete upgrade requires review.' }
    $sourceHash = (Get-FileHash -LiteralPath $sourceBinary -Algorithm SHA256).Hash
    $inputStream = [IO.File]::Open($sourceBinary, 'Open', 'Read', 'Read')
    try {
        $outputStream = [IO.File]::Open($stagedBinary, 'CreateNew', 'Write', 'None')
        try { $inputStream.CopyTo($outputStream); $outputStream.Flush($true) } finally { $outputStream.Dispose() }
    } finally { $inputStream.Dispose() }
    if ((Get-FileHash -LiteralPath $stagedBinary -Algorithm SHA256).Hash -ne $sourceHash) { throw 'Staged executable hash mismatch.' }
    $replaced = $false
    try {
        Stop-Service -Name $serviceName
        (Get-Service -Name $serviceName).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
        if ($existingService.ProcessId -gt 0) {
            $oldProcess = Get-Process -Id $existingService.ProcessId -ErrorAction SilentlyContinue
            if ($oldProcess -and -not $oldProcess.WaitForExit(30000)) { throw 'The old service process has not exited; binary was not replaced.' }
        }
        [IO.File]::Replace($stagedBinary, $installedBinary, $backupBinary)
        $replaced = $true
        Install-TrustedActivationLauncher
        Publish-RootRegistration $configuration $expectedSid
        Start-Service -Name $serviceName
        (Get-Service -Name $serviceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(15))
        Assert-ServiceReady
        if (-not (Test-Path -LiteralPath (Join-Path $stateDirectory 'service.backup.json'))) { [IO.File]::WriteAllText((Join-Path $stateDirectory 'service.backup.json'), (Get-Content -LiteralPath $configPath -Raw), [Text.UTF8Encoding]::new($false)) }
        # A backup is retained if startup fails; successful upgrades remove only this known executable backup.
        [IO.File]::Delete($backupBinary)
        [pscustomobject]@{ upgraded = $true; service = $serviceName; root = if($configuration.PSObject.Properties['root']){$configuration.root}else{$configuration.roots[0].path}; permissions_changed = $false } | ConvertTo-Json
    } catch {
        if ($replaced) {
            Stop-Service -Name $serviceName -ErrorAction SilentlyContinue
            (Get-Service -Name $serviceName).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
            [IO.File]::Replace($backupBinary, $installedBinary, [NullString]::Value)
            Start-Service -Name $serviceName
        } else {
            Start-Service -Name $serviceName -ErrorAction SilentlyContinue
        }
        throw
    }
    return
}
if ($Mode -eq 'Upgrade') { throw 'No managed service exists to upgrade. Choose fresh server setup.' }

if (-not (Test-Path -LiteralPath $sourceBinary -PathType Leaf)) {
    throw 'Build the service first: cargo build --manifest-path src-tauri/Cargo.toml --bin mgo-folder-protection --features folder-protection-service --release'
}
Assert-NoReparseAncestor $sourceBinary
$destinations = @($installDirectory, $stateDirectory, $testRoot)
if ($TestLocation -eq 'PrivateSandbox') { $destinations += $testParent }
foreach ($destination in $destinations) {
    Assert-NoReparseAncestor $destination
    if (Test-Path -LiteralPath $destination) { throw "Destination already exists; manual review required: $destination" }
}
if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) { throw 'Service already exists; this script does not overwrite or repair existing services.' }
if (Test-Path -LiteralPath $registryPath) { throw 'Service identity registration already exists; manual review required.' }
$drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($testRoot))
if ($drive.DriveFormat -ne 'NTFS' -or $drive.DriveType -ne 'Fixed') { throw 'The test location must be on a local fixed NTFS volume.' }

# Detect parent delete-child/write-DACL/ownership conflicts without changing drive ACLs.
$existingParent = if ($TestLocation -eq 'DriveD') { 'D:\' } else { $programDataBase }
$parentAcl = Get-Acl -LiteralPath $existingParent
$parentOwner = $parentAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value
if ($parentOwner -notin @('S-1-5-18', 'S-1-5-32-544')) { throw "Parent owner requires manual security review: $existingParent" }
foreach ($ace in $parentAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
    if ($ace.AccessControlType -eq 'Allow' -and -not ($ace.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly)) {
        $dangerous = [int]$ace.FileSystemRights -band 0x000D0040
        if ($dangerous -and $ace.IdentityReference.Value -notin @('S-1-5-18', 'S-1-5-32-544')) {
            throw "Parent grants an untrusted principal delete-child or security-control rights; stop and review: $existingParent"
        }
    }
}
$sidOutput = Invoke-ServiceControl @('showsid', $serviceName)
$serviceSid = [regex]::Match(($sidOutput -join "`n"), 'S-1-5-80-(?:\d+-){4}\d+').Value
if (-not $serviceSid) { throw 'Cannot resolve the virtual service SID.' }
$sourceHash = (Get-FileHash -LiteralPath $sourceBinary -Algorithm SHA256).Hash

$plan = [ordered]@{
    mode = $Mode
    computer = $env:COMPUTERNAME
    service = $serviceName
    service_account = $serviceAccount
    service_sid = $serviceSid
    authorized_user_sid = $authorizedIdentity.Value
    source_binary = $sourceBinary
    source_sha256 = $sourceHash
    executable = $installedBinary
    configuration = $configPath
    fresh_test_root = $testRoot
    test_location = $TestLocation
    registry = "$registryPath\ServerSid"
    startup = 'Automatic (virtual service account, no stored password)'
    permissions = @(
        'Fresh service binary directory: SYSTEM/Administrators Full Control; service Read & Execute',
        'Fresh state/config directory: SYSTEM/Administrators Full Control; service Modify',
        'Fresh test root only: SYSTEM/Administrators Full Control; service Modify; Authenticated Users Read & Execute',
        'PrivateSandbox test parent: SYSTEM/Administrators Full Control; service and Authenticated Users Read & Execute'
    )
    unchanged = 'D:\ parent permissions, production data, SMB shares, firewall, and MgoApp installer destination'
}
if ($Mode -eq 'Plan') { $plan | ConvertTo-Json -Depth 4; return }

$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Installation requires administrator approval. Open 64-bit PowerShell as Administrator and review -Mode Plan before -Mode Install.'
}


$createdService = $false
try {
    # These paths were verified absent. New-Item without -Force refuses concurrent replacement.
    New-Item -ItemType Directory -Path $installDirectory | Out-Null
    Set-FreshDirectoryPermissions $installDirectory 'ReadAndExecute' $false
    New-Item -ItemType Directory -Path $stateDirectory | Out-Null
    Set-FreshDirectoryPermissions $stateDirectory 'Modify' $false
    if ($TestLocation -eq 'PrivateSandbox') {
        New-Item -ItemType Directory -Path $testParent | Out-Null
        Set-FreshDirectoryPermissions $testParent 'ReadAndExecute' $true
    }
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $original = [ordered]@{ root = $testRoot; sddl_owner_group_dacl = (Get-Acl -LiteralPath $testRoot).Sddl }
    [IO.File]::WriteAllText((Join-Path $stateDirectory 'setup-acl-before.json'), ($original | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    Set-FreshDirectoryPermissions $testRoot 'Modify' $true

    # Write into a new file so that it inherits the private destination ACL, not the source ACL.
    $sourceStream = [IO.File]::Open($sourceBinary, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        $destinationStream = [IO.File]::Open($installedBinary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $sourceStream.CopyTo($destinationStream); $destinationStream.Flush($true) }
        finally { $destinationStream.Dispose() }
    } finally { $sourceStream.Dispose() }
    if ((Get-FileHash -LiteralPath $installedBinary -Algorithm SHA256).Hash -ne $sourceHash) { throw 'Binary changed during installation; stop and review.' }
    Install-TrustedActivationLauncher
    $configuration = [pscustomobject]@{ root = $testRoot; state_directory = $stateDirectory; users = @(@{ sid = $AuthorizedSid; write = $true }); aliases = @() }
    [IO.File]::WriteAllText($configPath, ($configuration | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText((Join-Path $stateDirectory 'setup-plan.json'), ($plan | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))

    $imagePath = '"' + $installedBinary + '" --service "' + $configPath + '"'
    Invoke-ServiceControl @('create', $serviceName, 'binPath=', $imagePath, 'start=', 'auto', 'obj=', $serviceAccount, 'DisplayName=', 'MGO Folder Protection') | Out-Null
    $createdService = $true
    Invoke-ServiceControl @('sidtype', $serviceName, 'unrestricted') | Out-Null
    # CreateSubKey also creates the missing MGO parent key; use the 64-bit view.
    Publish-RootRegistration $configuration $serviceSid
    Start-Service -Name $serviceName
    (Get-Service -Name $serviceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(15))
    Assert-ServiceReady
    if (-not (Test-Path -LiteralPath (Join-Path $stateDirectory 'service.backup.json'))) { [IO.File]::WriteAllText((Join-Path $stateDirectory 'service.backup.json'), (Get-Content -LiteralPath $configPath -Raw), [Text.UTF8Encoding]::new($false)) }
    $serviceStatus = Get-CimInstance Win32_Service -Filter "Name='MgoFolderProtection'"
    if ($serviceStatus.StartName -ne $serviceAccount -or $serviceStatus.State -ne 'Running') { throw 'Service account/status verification failed.' }
    [pscustomobject]@{ installed = $true; service = $serviceName; account = $serviceStatus.StartName; pid = $serviceStatus.ProcessId; root = $testRoot; next = 'Open MgoApp as the enrolled standard user and select Inspect Permissions.' } | ConvertTo-Json
} catch {
    if ($createdService) { Stop-Service -Name $serviceName -ErrorAction SilentlyContinue }
    # Do not recursively delete folders, restore permissions blindly, or remove recovery records.
    throw "Setup failed and any newly started service was stopped. Keep recovery files and review partial setup: $($_.Exception.Message)"
}
