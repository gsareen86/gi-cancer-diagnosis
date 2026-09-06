[CmdletBinding()]
param([int]$StartupTimeoutSeconds = 420, [int]$IdleSeconds = 0, [switch]$RestartModel)

# Start only configured local AI dependencies. Restart only an explicitly selected, verified idle model.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$serviceRoot = Join-Path $projectRoot 'services/ai'
$logRoot = Join-Path $projectRoot 'var/tmp/ai-runtime'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

function Read-Settings([string]$Path) {
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $values
}
function Probe([string]$Url) {
    try { return Invoke-RestMethod -Uri $Url -TimeoutSec 3 } catch { return $null }
}
function Local-Endpoint([string]$Value, [string]$Name) {
    $uri = [uri]$Value
    if (!$uri.IsAbsoluteUri -or $uri.Scheme -ne 'http' -or $uri.Host -notin @('localhost', '127.0.0.1', '[::1]', '::1')) {
        throw "$Name must be an existing local HTTP endpoint; remote deployments are not modified."
    }
    return $uri
}
function Wait-Ready([string]$Url, [System.Diagnostics.Process]$Process, [string]$Name) {
    $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    do {
        $result = Probe $Url
        if ($null -ne $result) { return $result }
        if ($null -ne $Process -and $Process.HasExited) { throw "$Name exited. See $logRoot." }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "$Name did not become ready. See $logRoot."
}

$webSettings = Read-Settings (Join-Path $projectRoot '.env')
$aiSettings = Read-Settings (Join-Path $serviceRoot '.env')
if ($aiSettings['AI_PROVIDER'] -notin @('llamacpp', 'llama.cpp', 'local')) {
    throw 'This launcher only starts the already-configured local model provider.'
}
if (!$webSettings['AI_SERVICE_TOKEN'] -or $webSettings['AI_SERVICE_TOKEN'] -cne $aiSettings['AI_SERVICE_TOKEN']) {
    throw 'AI_SERVICE_TOKEN must be configured identically in the root and AI-service .env files.'
}
$aiUri = Local-Endpoint $webSettings['AI_SERVICE_URL'] 'AI_SERVICE_URL'
$modelUri = Local-Endpoint $aiSettings['LLAMA_SERVER_URL'] 'LLAMA_SERVER_URL'
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$modelBinary = $webSettings['LLAMA_SERVER_BIN']
$modelPath = $webSettings['LLAMA_MODEL']
if ($IdleSeconds -eq 0) {
    $IdleSeconds = if ($aiSettings['LOCAL_MODEL_IDLE_SECONDS']) { [int]$aiSettings['LOCAL_MODEL_IDLE_SECONDS'] } else { 300 }
}
if ($IdleSeconds -ne -1 -and ($IdleSeconds -lt 1 -or $IdleSeconds -gt 86400)) {
    throw 'IdleSeconds / LOCAL_MODEL_IDLE_SECONDS must be 1..86400 seconds, or -1 to explicitly disable sleep.'
}

$modelHealth = Probe "$($modelUri.AbsoluteUri.TrimEnd('/'))/props"
if ($null -eq $modelHealth) {
    $warmingListener = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $modelUri.Port })
    if ($warmingListener.Count -gt 0) {
        Write-Host 'Model port is occupied but readiness is delayed. Waiting; no second model will be started.'
        $modelHealth = Wait-Ready "$($modelUri.AbsoluteUri.TrimEnd('/'))/props" $null 'Existing model server'
    }
}
if ($RestartModel -and $null -ne $modelHealth) {
    # An explicit migration/reconfiguration only. Never kill an unknown listener or active task.
    $listeners = @(Get-NetTCPConnection -LocalPort $modelUri.Port -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($listeners.Count -ne 1) { throw 'Cannot identify exactly one model listener. No process stopped.' }
    $modelOwner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listeners[0])"
    $expectedBinary = (Resolve-Path -LiteralPath $modelBinary).Path
    $expectedModel = (Resolve-Path -LiteralPath $modelPath).Path
    if ($modelOwner.ExecutablePath -ine $expectedBinary -or !$modelOwner.CommandLine.Contains($expectedModel)) {
        throw 'Listener does not match the configured model binary and model file. No process stopped.'
    }
    $restartHelp = (& $modelBinary --help 2>&1 | Out-String)
    if (!$restartHelp.Contains('--sleep-idle-seconds')) { throw 'Native idle sleep is not supported. The existing process was not stopped.' }
    if (!$modelHealth.is_sleeping) {
        $slots = Probe "$($modelUri.AbsoluteUri.TrimEnd('/'))/slots"
        if ($null -eq $slots -or @($slots | Where-Object { $_.is_processing }).Count -gt 0) {
            throw 'The model is busy or slot status is unavailable. Retry after all AI requests finish.'
        }
    }
    Stop-Process -Id $modelOwner.ProcessId -Force -ErrorAction Stop
    Wait-Process -Id $modelOwner.ProcessId -Timeout 15 -ErrorAction SilentlyContinue
    $modelHealth = $null
}
if ($null -eq $modelHealth) {
    if (!(Test-Path -LiteralPath $modelBinary -PathType Leaf) -or !(Test-Path -LiteralPath $modelPath -PathType Leaf)) {
        throw 'Configured LLAMA_SERVER_BIN or LLAMA_MODEL is missing. No model is downloaded automatically.'
    }
    $alias = [IO.Path]::GetFileNameWithoutExtension($modelPath)
    $context = if ($aiSettings['LOCAL_MODEL_CONTEXT']) { [int]$aiSettings['LOCAL_MODEL_CONTEXT'] } else { 8192 }
    $serverHelp = (& $modelBinary --help 2>&1 | Out-String)
    if (!$serverHelp.Contains('--sleep-idle-seconds')) { throw 'The configured llama-server does not support native idle sleep. Upgrade explicitly; no binary is downloaded.' }
    $savedEnvironment = @{}
    try {
        foreach ($entry in @{ HIP_VISIBLE_DEVICES = '0'; GGML_VULKAN_UNIFIED_MEMORY = '1'; ROCBLAS_USE_HIPBLASLT = '1' }.GetEnumerator()) {
            $savedEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
            [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
        }
        $modelProcess = Start-Process -FilePath $modelBinary -WindowStyle Hidden -PassThru -WorkingDirectory (Split-Path $modelBinary) -ArgumentList @(
            '-m', ('"' + $modelPath + '"'), '--host', '127.0.0.1', '--port', $modelUri.Port,
            '--alias', ('"' + $alias + '"'), '-c', $context, '-ngl', '99', '--no-mmap',
            '--sleep-idle-seconds', $IdleSeconds,
            '--flash-attn', 'on', '-b', '512', '-ub', '64', '-t', '4', '-tb', '12', '-ctk', 'q8_0', '-ctv', 'q8_0'
        ) -RedirectStandardOutput (Join-Path $logRoot "model-$runStamp.out.log") -RedirectStandardError (Join-Path $logRoot "model-$runStamp.err.log")
    } finally {
        foreach ($key in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $savedEnvironment[$key], 'Process') }
    }
    Write-Host "Loading configured local model (PID $($modelProcess.Id))..."
    $modelHealth = Wait-Ready "$($modelUri.AbsoluteUri.TrimEnd('/'))/props" $modelProcess 'Model server'
    Write-Host "Native idle sleep configured: $IdleSeconds seconds. New AI tasks wake the model automatically."
} else {
    Write-Host 'Existing model listener preserved. Use -RestartModel when idle to apply a changed idle timeout.'
}
$servedModel = $modelHealth.model_alias
if (!$servedModel -or $servedModel -match 'stub|not-a-real-model') { throw 'Model endpoint does not identify a real model. No test stub is accepted.' }
Write-Host "Model listener ready: $servedModel (sleeping: $($modelHealth.is_sleeping))"

$aiHealth = Probe "$($aiUri.AbsoluteUri.TrimEnd('/'))/health"
if ($null -eq $aiHealth) {
    $python = Join-Path $serviceRoot '.venv/Scripts/python.exe'
    if (!(Test-Path -LiteralPath $python -PathType Leaf)) { throw 'AI service virtualenv is missing.' }
    $aiProcess = Start-Process -FilePath $python -WindowStyle Hidden -PassThru -WorkingDirectory $serviceRoot -ArgumentList @(
        '-m', 'uvicorn', 'gi_ai.app:app', '--host', '127.0.0.1', '--port', $aiUri.Port, '--env-file', '.env'
    ) -RedirectStandardOutput (Join-Path $logRoot "ai-$runStamp.out.log") -RedirectStandardError (Join-Path $logRoot "ai-$runStamp.err.log")
    $aiHealth = Wait-Ready "$($aiUri.AbsoluteUri.TrimEnd('/'))/health" $aiProcess 'AI service'
}
if ($aiHealth.provider -ne 'llamacpp' -or !$aiHealth.reachable -or $aiHealth.servedModel -ne $servedModel) {
    throw 'AI service is answering but is not connected to the expected local model.'
}
Write-Host "AI service ready on $($aiUri.Port); model reachable on $($modelUri.Port)."
if (!$aiHealth.PSObject.Properties['modelState']) { Write-Warning 'The existing AI gateway predates non-waking health checks. Restart that gateway before relying on idle sleep.' }
Write-Host "Existing web/database/storage/mail processes were left untouched. Logs: $logRoot"
