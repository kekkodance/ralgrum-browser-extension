# Removes the ralgrum:// protocol handler for the current user.
$ErrorActionPreference = "Stop"
$key = "HKCU:\Software\Classes\ralgrum"
if (Test-Path $key) {
  Remove-Item -Recurse -Force -LiteralPath $key
  Write-Host "Removed ralgrum protocol handler."
} else {
  Write-Host "ralgrum protocol handler was not registered."
}
