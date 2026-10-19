param([string]$Apk='dist\纸间-1.2.0.apk',[string]$JavaHome=$env:JAVA_HOME)
if(!$JavaHome -or !(Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))){throw '请配置 JAVA_HOME，或传入 -JavaHome 指定 JDK 17 或以上目录'}
$ErrorActionPreference='Stop';$root=Split-Path $PSScriptRoot -Parent;$env:JAVA_HOME=$JavaHome
$apkPath=if([IO.Path]::IsPathRooted($Apk)){$Apk}else{Join-Path $root $Apk}
$tools=Join-Path $root '.toolchain\android-sdk\build-tools\36.0.0'
& (Join-Path $tools 'apksigner.bat') verify --verbose --print-certs $apkPath
if($LASTEXITCODE){throw 'APK 签名校验失败'}
$badging=& (Join-Path $tools 'aapt2.exe') dump badging $apkPath;if($LASTEXITCODE){throw 'APK 元数据读取失败'}
if(!($badging -match "package: name='app.zhijian.notes'")){throw '包名不正确'}
if(!($badging -match "sdkVersion:'26'")){throw '最低安卓版本不正确'}
if($badging -match '^application-debuggable'){throw '交付 APK 不应启用调试'}
$permissions=& (Join-Path $tools 'aapt2.exe') dump permissions $apkPath;if($permissions -match 'android.permission.INTERNET'){throw '应用不应包含联网权限'}
$zip=[IO.Compression.ZipFile]::OpenRead($apkPath)
try{
 $names=@($zip.Entries|ForEach-Object FullName)
 foreach($needed in @('classes.dex','assets/web/index.html','assets/web/app.js','assets/web/editor.js','assets/web/editor-tools.js','assets/web/editor-upgrade.css','assets/web/library-upgrade.css','assets/web/review.js','assets/web/canvas-workshop.js','assets/web/canvas-workshop.css','assets/web/note-images.js','assets/web/note-utilities.js','assets/web/note-knowledge.js','assets/web/note-files.js','assets/web/reminder-dialog.js','assets/web/vendor/quill.js','assets/web/vendor/markdown-it.js','assets/web/vendor/purify.js','assets/web/vendor/turndown.js','assets/web/vendor/commonmark-java-LICENSE.txt')){if($names -notcontains $needed){throw "安装包缺少离线资源：$needed"}}
 if($names -match '(?i)(\.jks$|signing\.properties|\.signing/|\.toolchain/)'){throw '安装包含不应交付的私有构建文件'}
}finally{$zip.Dispose()}
$locks=Get-Content -LiteralPath (Join-Path $root 'vendor-lock.json') -Raw|ConvertFrom-Json
foreach($item in $locks){$file=Join-Path $root ('app\src\main\assets\web\vendor\'+$item.file);if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $item.sha256){throw "离线依赖哈希不匹配：$($item.file)"}}
$badging|Select-String -Pattern '^package:','^sdkVersion:','^minSdkVersion:','^targetSdkVersion:','^launchable-activity:'
Write-Output 'PASS signature, package, SDK, no INTERNET permission, local assets, vendor hashes and private-file exclusion'
