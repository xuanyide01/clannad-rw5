$ErrorActionPreference='Stop'
$clanProject=Split-Path $PSScriptRoot -Parent
$clanWork=Split-Path $clanProject -Parent
$env:NODE_PATH=Join-Path $clanWork 'starry-rw5/node_modules'
$env:STARRY_EMULATOR_HOME=Join-Path $clanWork 'clannad-ui-environment'
$env:WATCH_SDK_HOME=Join-Path $clanWork 'vela-environment/sdk'
$env:WATCH_ADB_PATH=Join-Path $clanWork 'starry-rw5/node_modules/@miwt/adb/bin/win/adb.exe'
$env:WATCH_VVD_NAME='ClannadUI20261025'
$env:WATCH_SERIAL_PORT='5578'
$env:WATCH_GRPC_PORT='8578'
$env:WATCH_DEBUG_PORT='10078'
$env:WATCH_HTTP_PORT='43162'
try { $clanExisting=Invoke-RestMethod 'http://127.0.0.1:43162/info' -TimeoutSec 3 } catch { $clanExisting=$null }
if($clanExisting) {
 if($clanExisting.name -ne $env:WATCH_VVD_NAME){throw 'Preview port belongs to another device'}
 Write-Output 'Existing CLANNAD UI preview: http://127.0.0.1:43162/'
 exit 0
}
$clanNode=(Get-Command node).Source
$clanProcess=Start-Process -FilePath $clanNode -ArgumentList @('tools/emulator-server.cjs') -WorkingDirectory $clanProject -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $env:STARRY_EMULATOR_HOME 'controller.log') -RedirectStandardError (Join-Path $env:STARRY_EMULATOR_HOME 'controller-error.log')
Write-Output ('CLANNAD preview controller PID '+$clanProcess.Id+'; http://127.0.0.1:43162/')
