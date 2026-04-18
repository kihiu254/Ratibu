param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF,
  [switch]$LinkProject
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$functionsRoot = Join-Path $repoRoot 'supabase/functions'

if (-not (Test-Path $functionsRoot)) {
  throw "Could not find Supabase functions directory at $functionsRoot"
}

$functionNames = Get-ChildItem -Path $functionsRoot -Directory |
  Where-Object { $_.Name -ne '_shared' } |
  Sort-Object Name |
  Select-Object -ExpandProperty Name

if ($functionNames.Count -eq 0) {
  Write-Host 'No Edge Functions found to deploy.'
  exit 0
}

if ($LinkProject -and $ProjectRef) {
  Write-Host "Linking Supabase project $ProjectRef..."
  supabase link --project-ref $ProjectRef
}

foreach ($name in $functionNames) {
  Write-Host "Deploying Edge Function: $name"
  if ($ProjectRef) {
    supabase functions deploy $name --project-ref $ProjectRef
  } else {
    supabase functions deploy $name
  }
}

Write-Host 'All Edge Functions deployed successfully.'
