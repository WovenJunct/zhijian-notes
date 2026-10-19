param([switch]$Debug,[switch]$Release,[string]$JavaHome=$env:JAVA_HOME,[string]$BuildAlias='')
$ErrorActionPreference='Stop';$root=Split-Path $PSScriptRoot -Parent
if(!$JavaHome -or !(Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))){throw '请配置 JAVA_HOME，或传入 -JavaHome 指定 JDK 17 或以上目录'}
$env:JAVA_HOME=$JavaHome
if(!$BuildAlias -and $root -match '[^\x00-\x7F]'){$sha=[System.Security.Cryptography.SHA256]::Create();$key=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($root)))).Replace('-','').Substring(0,12);$BuildAlias=Join-Path ([IO.Path]::GetTempPath()) ('zhijian-build-'+$key)}
$buildRoot=$root
if($BuildAlias){
 if(!(Test-Path -LiteralPath $BuildAlias)){New-Item -ItemType Junction -Path $BuildAlias -Target $root|Out-Null}
 $link=Get-Item -LiteralPath $BuildAlias;if($link.LinkType -ne 'Junction' -or [string]$link.Target -ne $root){throw '构建别名已被其他目录占用，请指定新的 -BuildAlias'};$buildRoot=$BuildAlias
}
if(!(Test-Path -LiteralPath (Join-Path $root '.toolchain\gradle-8.13\bin\gradle.bat'))){& (Join-Path $root 'scripts\setup.ps1') -JavaHome $JavaHome}
$sign=Join-Path $root '.signing';New-Item -ItemType Directory -Force -Path $sign|Out-Null
if(!$Debug -and !(Test-Path -LiteralPath (Join-Path $sign 'zhijian.jks'))){
 $bytes=New-Object byte[] 24;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes);$env:PAPER_SIGN_PASSWORD=[Convert]::ToBase64String($bytes)
 & (Join-Path $JavaHome 'bin\keytool.exe') -genkeypair -keystore (Join-Path $sign 'zhijian.jks') -storepass:env PAPER_SIGN_PASSWORD -keypass:env PAPER_SIGN_PASSWORD -alias zhijian -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Zhijian Notes, O=Personal, C=CN'
 if($LASTEXITCODE){throw '签名密钥生成失败'}
 @(('storePassword='+$env:PAPER_SIGN_PASSWORD),('keyPassword='+$env:PAPER_SIGN_PASSWORD))|Set-Content -LiteralPath (Join-Path $sign 'signing.properties') -Encoding ascii
 Remove-Item Env:PAPER_SIGN_PASSWORD
}
Push-Location $buildRoot
try{$tasks=if($Debug){@(':app:assembleDebug',':app:assembleDebugAndroidTest')}else{@(':app:testDebugUnitTest',':app:lintDebug',':app:assembleRelease')}; & '.\gradlew.bat' @tasks --console plain;if($LASTEXITCODE){throw 'Android build failed'}
 if(!$Debug){New-Item -ItemType Directory -Force -Path 'dist'|Out-Null;$versionText=Get-Content 'app\build.gradle' -Raw;$version=[regex]::Match($versionText,"versionName '([^']+)'").Groups[1].Value;if(!$version){throw '未找到发布版本号'};$releaseName='纸间-'+$version+'.apk';Copy-Item -LiteralPath 'app\build\outputs\apk\release\app-release.apk' -Destination (Join-Path 'dist' $releaseName);Write-Output ('APK: '+(Join-Path $root ('dist\'+$releaseName)))}
}finally{Pop-Location}
