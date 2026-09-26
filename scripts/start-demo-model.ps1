param([switch]$Restart)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $taskRoot '.env.model'
if (!(Test-Path -LiteralPath $settingsPath)) { throw 'Configure .env.model with LLAMA_SERVER_BIN and LLAMA_MODEL first.' }
$modelConfig = @{}
Get-Content -LiteralPath $settingsPath | ForEach-Object { if ($_ -match '^([A-Z][A-Z0-9_]*)=(.*)$') { $modelConfig[$Matches[1]] = $Matches[2].Trim('"') } }
foreach ($key in @('LLAMA_SERVER_BIN','LLAMA_MODEL')) { if (!(Test-Path -LiteralPath $modelConfig[$key])) { throw "Missing configured $key" } }
$contextSize = if ($modelConfig['LLAMA_CONTEXT']) { [int]$modelConfig['LLAMA_CONTEXT'] } else { 16384 }
if ($contextSize -lt 4096) { throw 'LLAMA_CONTEXT must be at least 4096.' }
$fileKeys = @('LLAMA_SERVER_BIN','LLAMA_MODEL')
if ($modelConfig['LLAMA_MMPROJ']) { $fileKeys += 'LLAMA_MMPROJ'; if (!(Test-Path -LiteralPath $modelConfig['LLAMA_MMPROJ'])) { throw 'Missing configured LLAMA_MMPROJ' } }
$healthy = $false
try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8081/health' -TimeoutSec 2; $healthy = $health.status -eq 'ok' } catch {}
if ($Restart) {
  $pidPath = Join-Path $taskRoot 'var/model/pid'
  if (!(Test-Path -LiteralPath $pidPath)) { throw 'No owned model process recorded; refusing to stop an unknown listener.' }
  $modelPid = [int](Get-Content -LiteralPath $pidPath -Raw)
  $owned = Get-CimInstance Win32_Process -Filter "ProcessId=$modelPid"
  if ($owned -and $owned.ExecutablePath -eq $modelConfig['LLAMA_SERVER_BIN'] -and $owned.CommandLine.Contains($modelConfig['LLAMA_MODEL']) -and $owned.CommandLine.Contains('--port 8081')) {
    $ended = Invoke-CimMethod -InputObject $owned -MethodName Terminate
    if ($ended.ReturnValue -ne 0) { throw 'The owned demo model could not be stopped.' }
    $healthy = $false
  } elseif ($owned) { throw 'Recorded PID is not the owned demo model; refusing to stop it.' }
}
if ($healthy) {
  $receiptPath = Join-Path $taskRoot 'var/model/identity.json'
  if (!(Test-Path -LiteralPath $receiptPath)) { throw 'Running endpoint has no startup receipt. Verify ownership before restarting.' }
  $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
  if (!$receipt.files -or $receipt.context -ne $contextSize -or ($modelConfig['LLAMA_MMPROJ'] -and $receipt.projectorSha256 -ne $modelConfig['LLAMA_MMPROJ_SHA256']) -or $receipt.modelSha256 -ne $modelConfig['LLAMA_MODEL_SHA256'] -or $receipt.binarySha256 -ne $modelConfig['LLAMA_BINARY_SHA256']) { throw 'Restart the owned model with npm run demo:model -- -Restart to verify its pinned files.' }
  Write-Output 'Local endpoint already responds; preflight verifies its startup receipt and served identity.'
  exit 0
}
$taskLogs = Join-Path $taskRoot 'var/model'
New-Item -ItemType Directory -Path $taskLogs -Force | Out-Null
$binaryHash = (Get-FileHash -LiteralPath $modelConfig['LLAMA_SERVER_BIN'] -Algorithm SHA256).Hash
$modelHash = (Get-FileHash -LiteralPath $modelConfig['LLAMA_MODEL'] -Algorithm SHA256).Hash
if ($binaryHash -ne $modelConfig['LLAMA_BINARY_SHA256'] -or $modelHash -ne $modelConfig['LLAMA_MODEL_SHA256']) { throw 'Local binary or model does not match its pinned SHA256 in .env.model.' }
$verifiedFiles = @()
$projectorHash = $null
if ($modelConfig['LLAMA_MMPROJ']) { $projectorHash = (Get-FileHash -LiteralPath $modelConfig['LLAMA_MMPROJ'] -Algorithm SHA256).Hash; if ($projectorHash -ne $modelConfig['LLAMA_MMPROJ_SHA256']) { throw 'Projector does not match its pinned SHA256.' } }
foreach ($key in $fileKeys) {
  $file = Get-Item -LiteralPath $modelConfig[$key]
  $hash = if ($key -eq 'LLAMA_MODEL') { $modelHash } elseif ($key -eq 'LLAMA_MMPROJ') { $projectorHash } else { $binaryHash }
  $verifiedFiles += @{ path=$file.FullName; sha256=$hash; size=$file.Length; modifiedAt=$file.LastWriteTimeUtc.ToString('o') }
}
# Hash before loading the large model, then bind the receipt to unchanged file metadata.
# Reading the entire weight file again during inference causes avoidable RAM pressure.
@{ binarySha256=$binaryHash; modelSha256=$modelHash; projectorSha256=$projectorHash; files=$verifiedFiles; model='gi-compass-local'; context=$contextSize; startedAt=(Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $taskLogs 'identity.json')
$arguments = @('--model',('"'+$modelConfig['LLAMA_MODEL']+'"'),'--host','127.0.0.1','--port','8081','--alias','gi-compass-local','--ctx-size',"$contextSize",'--parallel','1','--reasoning','off','--log-disable')
if ($modelConfig['LLAMA_MMPROJ']) { $arguments += @('--mmproj',('"'+$modelConfig['LLAMA_MMPROJ']+'"')) }
$process = Start-Process -FilePath $modelConfig['LLAMA_SERVER_BIN'] -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogs 'stdout.log') -RedirectStandardError (Join-Path $taskLogs 'stderr.log')
$process.Id | Set-Content -LiteralPath (Join-Path $taskLogs 'pid')
Write-Output "Started local model process $($process.Id)."
