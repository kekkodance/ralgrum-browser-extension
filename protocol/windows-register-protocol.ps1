# Registers the ralgrum:// protocol for the current user (no admin needed).
# Points at ralgruM.exe so browser buttons can open the desktop app.
param(
  [string]$ExePath = "",
  [switch]$Unregister
)
$ErrorActionPreference = "Stop"
$key = "HKCU:\Software\Classes\ralgrum"
if ($Unregister) {
  if (Test-Path $key) {
    Remove-Item -Recurse -Force -LiteralPath $key
    Write-Host "Removed ralgrum protocol handler."
  } else {
    Write-Host "ralgrum protocol handler was not registered."
  }
  exit 0
}
if ([string]::IsNullOrWhiteSpace($ExePath)) {
  $local = [Environment]::GetFolderPath("LocalApplicationData")
  $ExePath = Join-Path $local "ralgruM\ralgruM.exe"
}
if (-not (Test-Path -LiteralPath $ExePath)) {
  Write-Host "Warning: exe not found at $ExePath"
  Write-Host "Pass -ExePath with the real ralgruM.exe location."
}
New-Item -Force -Path $key | Out-Null
Set-ItemProperty -LiteralPath $key -Name "(Default)" -Value "URL:ralgruM"
Set-ItemProperty -LiteralPath $key -Name "URL Protocol" -Value ""
New-Item -Force -Path "$key\shell\open\command" | Out-Null
$cmd = '"' + $ExePath + '" "%1"'
Set-ItemProperty -LiteralPath "$key\shell\open\command" -Name "(Default)" -Value $cmd
Write-Host "Registered ralgrum:// to $ExePath"
Write-Host "Test it from Run or a browser with a ralgrum://open link."
