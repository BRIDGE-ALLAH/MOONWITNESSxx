[CmdletBinding()]
param(
  [ValidateSet('minimal', 'headquarter', 'arsy', 'full-dev')]
  [string]$Profile = 'full-dev',
  [switch]$Offline,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js >=20 is required. Install Node.js, then rerun this script.'
}

$arguments = @(
  (Join-Path $PSScriptRoot 'scripts/moonwitness.mjs'),
  'install',
  '--profile',
  $Profile
)
if ($Offline) { $arguments += '--offline' }
if ($DryRun) { $arguments += '--dry-run' }

& node @arguments
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
