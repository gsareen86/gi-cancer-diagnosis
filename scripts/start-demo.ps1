param([switch]$Production,[switch]$RestartWorker)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$node = (Get-Command node -ErrorAction Stop).Source
$provider = & $node (Join-Path $taskRoot 'node_modules/tsx/dist/cli.mjs') (Join-Path $PSScriptRoot 'selected-provider.ts')
if ($LASTEXITCODE -ne 0) { throw 'AI provider configuration is invalid.' }
if ($provider -eq 'local') {
  & (Join-Path $PSScriptRoot 'start-demo-model.ps1')
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'Local model startup failed.' }
} else { Write-Output "Using configured $provider provider." }
$runtime = Join-Path $taskRoot 'var/demo-runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$node = (Get-Command node -ErrorAction Stop).Source
$workerPath = Join-Path $PSScriptRoot 'demo-worker.ts'
$workerState = Join-Path $runtime 'worker-demo.json'
$workerRunning = $false
if (Test-Path -LiteralPath $workerState) {
  $state = Get-Content -LiteralPath $workerState -Raw | ConvertFrom-Json
  $workerProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
  $workerRunning = $workerProcess -and $workerProcess.CommandLine.Contains($workerPath) -and $state.state -ne 'stopped'
}
if ($workerRunning -and $RestartWorker) {
  $ended = Invoke-CimMethod -InputObject $workerProcess -MethodName Terminate
  if ($ended.ReturnValue -ne 0) { throw 'The owned demo worker could not be restarted.' }
  $workerRunning = $false
}
if (!$workerRunning) {
  $arguments = @(('"'+(Join-Path $taskRoot 'node_modules/tsx/dist/cli.mjs')+'"'),('"'+$workerPath+'"'))
  Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'worker.log') -RedirectStandardError (Join-Path $runtime 'worker-error.log') | Out-Null
  Write-Output 'Started independent report and assessment worker.'
} else { Write-Output 'Processing worker is already running.' }
$appRunning = $false
try { $response = Invoke-WebRequest 'http://localhost:3000/sign-in' -UseBasicParsing -TimeoutSec 5; $appRunning = $response.StatusCode -eq 200 } catch {}
if (!$appRunning) {
  if ($Production -and !(Test-Path -LiteralPath (Join-Path $taskRoot '.next/BUILD_ID'))) { throw 'Run npm run build before starting production mode.' }
  $mode = if ($Production) { 'start' } else { 'dev' }
  $arguments = @(('"'+(Join-Path $taskRoot 'node_modules/next/dist/bin/next')+'"'),$mode,'--hostname','localhost','--port','3000')
  Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'app.log') -RedirectStandardError (Join-Path $runtime 'app-error.log') | Out-Null
  Write-Output "Started local app in $mode mode."
} else { Write-Output 'App is already responding on localhost:3000.' }
Write-Output 'Allow the model to finish loading, then run npm run demo:preflight. No patient payloads are written to worker logs.'
