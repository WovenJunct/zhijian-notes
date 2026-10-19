param([string]$JavaHome=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
if(!$JavaHome -or !(Test-Path -LiteralPath (Join-Path $JavaHome 'bin\javac.exe'))){throw '请配置 JAVA_HOME，或传入 -JavaHome 指定 JDK 17 或以上目录'}
$root=Split-Path $PSScriptRoot -Parent
$libs=Join-Path $root '.toolchain\test-libs';$out=Join-Path $root '.toolchain\test-classes'
New-Item -ItemType Directory -Force -Path $libs,$out|Out-Null
foreach($p in @(@('org/json/json/20250517/json-20250517.jar','json.jar'),@('junit/junit/4.13.2/junit-4.13.2.jar','junit.jar'),@('org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar','hamcrest.jar'),@('org/commonmark/commonmark/0.21.0/commonmark-0.21.0.jar','commonmark.jar'))) {
 $target=Join-Path $libs $p[1];if(!(Test-Path -LiteralPath $target)){& curl.exe -fsSL --max-time 60 ('https://repo.maven.apache.org/maven2/'+$p[0]) -o $target;if($LASTEXITCODE){throw 'Test dependency download failed'}}
}
$cp=(Get-ChildItem -LiteralPath $libs -Filter '*.jar'|ForEach-Object FullName)-join ';'
$main=Join-Path $root 'app\src\main\java\app\zhijian\notes'
$sources=@(Get-ChildItem -LiteralPath (Join-Path $main 'data') -Filter '*.java'|Where-Object {$_.Name -ne 'PaperDb.java'}|ForEach-Object FullName)+@(Get-ChildItem -LiteralPath (Join-Path $main 'backup') -Filter '*.java'|Where-Object {$_.Name -in 'ArchivePolicy.java','MergePlanner.java','ArchiveCodec.java'}|ForEach-Object FullName)+@(Get-ChildItem -LiteralPath (Join-Path $root 'app\src\test\java') -Recurse -Filter '*.java'|ForEach-Object FullName)
& (Join-Path $JavaHome 'bin\javac.exe') -encoding UTF-8 -cp $cp -d $out @sources
if($LASTEXITCODE){throw 'Core test compilation failed'}
$testClasses=@(Get-ChildItem -LiteralPath (Join-Path $root 'app\src\test\java') -Recurse -Filter '*Test.java'|ForEach-Object {'app.zhijian.notes.'+$_.BaseName})
& (Join-Path $JavaHome 'bin\java.exe') -cp ($out+';'+$cp) org.junit.runner.JUnitCore @testClasses
if($LASTEXITCODE){throw 'Core tests failed'}
