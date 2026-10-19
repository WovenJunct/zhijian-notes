param([string]$Destination='',[string]$Archive='',[string]$Node='node',[string]$Git='git')
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
if(!$Destination){$Destination=Join-Path (Split-Path $root -Parent) ((Split-Path $root -Leaf)+'-public')}
$Destination=[IO.Path]::GetFullPath($Destination)
if($Destination -eq $root -or $Destination.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or $root.StartsWith($Destination+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw '请选择项目目录之外的新公开源码目录'}
if(Test-Path -LiteralPath $Destination){throw '目标目录已存在，请选择新目录；脚本不会覆盖已有文件'}
$version=[regex]::Match([IO.File]::ReadAllText((Join-Path $root 'app\build.gradle')),"versionName '([^']+)'").Groups[1].Value
if(!$Archive){$Archive=Join-Path $root ('dist\纸间-'+$version+'-公开源码.zip')}
$Archive=[IO.Path]::GetFullPath($Archive)
if(Test-Path -LiteralPath $Archive){throw '源码 ZIP 已存在，请选择新的 -Archive 路径'}
Push-Location $root
try{
 $files=& $Git -c core.quotepath=false ls-files
 if($LASTEXITCODE){throw '请在 Git 源码仓库中运行，并先将需要发布的新文件加入暂存区'}
 New-Item -ItemType Directory -Path $Destination | Out-Null
 foreach($relative in $files){
  if($relative -match '(^|/)(\.git|\.signing|\.private|\.toolchain|\.gradle|node_modules|build|dist|test-results|playwright-report)/|\.(jks|keystore|p12|pem|log|apk)$|(^|/)(local\.properties|signing\.properties|\.env[^/]*)$'){throw "发布清单含本地文件：$relative"}
  $source=Join-Path $root $relative;if(!(Test-Path -LiteralPath $source -PathType Leaf)){continue}
  if((Get-Item -LiteralPath $source).LinkType){throw "发布清单含符号链接：$relative"}
  $target=Join-Path $Destination $relative;New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target
 }
 & $Node (Join-Path $PSScriptRoot 'check-public.mjs') $Destination
 if($LASTEXITCODE){throw '公开源码检查未通过，未生成 ZIP'}
 New-Item -ItemType Directory -Force -Path (Split-Path $Archive -Parent) | Out-Null
 [IO.Compression.ZipFile]::CreateFromDirectory($Destination,$Archive,[IO.Compression.CompressionLevel]::Optimal,$false)
 Write-Output 'Public source folder and ZIP prepared without Git history, signing files or caches.'
}finally{Pop-Location}
