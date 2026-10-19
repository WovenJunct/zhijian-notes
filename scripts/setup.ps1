param([string]$JavaHome=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$toolsRoot=Join-Path $projectRoot '.toolchain'
New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
function Download([string]$Url,[string]$Target) {
  if (!(Test-Path -LiteralPath $Target)) { & curl.exe -fSL --retry 2 --connect-timeout 20 --max-time 600 $Url -o $Target; if ($LASTEXITCODE) { throw "Download failed: $Url" } }
}
Download 'https://dl.google.com/android/repository/repository2-3.xml' (Join-Path $toolsRoot 'repository.xml')
[xml]$repo=Get-Content -LiteralPath (Join-Path $toolsRoot 'repository.xml')
$sdkRoot=Join-Path $toolsRoot 'android-sdk'
New-Item -ItemType Directory -Force -Path $sdkRoot | Out-Null
foreach($entry in @(@('platforms;android-36','platforms\android-36'),@('build-tools;36.0.0','build-tools\36.0.0'),@('platform-tools','platform-tools'))) {
  $pkg=$repo.SelectNodes('//*[local-name()="remotePackage"]') | Where-Object {$_.path -eq $entry[0]}
  $archive=$pkg.archives.archive | Where-Object {!$_.'host-os' -or $_.'host-os' -eq 'windows'} | Select-Object -First 1
  $zip=Join-Path $toolsRoot $archive.complete.url
  $target=Join-Path $sdkRoot $entry[1]
  if (!(Test-Path -LiteralPath (Join-Path $target 'source.properties'))) {
    Download ('https://dl.google.com/android/repository/'+$archive.complete.url) $zip
    $algorithm=$archive.complete.checksum.type.ToUpperInvariant()
    if ((Get-FileHash -LiteralPath $zip -Algorithm $algorithm).Hash -ne $archive.complete.checksum.InnerText) {throw 'SDK checksum mismatch'}
    $unpack=Join-Path $toolsRoot ('unpack-'+[guid]::NewGuid().ToString('N'))
    Expand-Archive -LiteralPath $zip -DestinationPath $unpack
    $folder=Get-ChildItem -LiteralPath $unpack -Directory | Select-Object -First 1
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Move-Item -LiteralPath $folder.FullName -Destination $target
    $xmlDoc=New-Object System.Xml.XmlDocument
    $root=$xmlDoc.CreateElement('ns2','repository','http://schemas.android.com/repository/android/common/02')
    $xmlDoc.AppendChild($root) | Out-Null
    foreach($attribute in $repo.DocumentElement.Attributes){$root.Attributes.Append($xmlDoc.ImportNode($attribute,$true))|Out-Null}
    foreach($license in $repo.SelectNodes('//*[local-name()="license"]')){$root.AppendChild($xmlDoc.ImportNode($license,$true))|Out-Null}
    $local=$xmlDoc.CreateElement('localPackage'); $local.SetAttribute('path',$entry[0]); $root.AppendChild($local) | Out-Null
    foreach($name in @('type-details','revision','display-name','uses-license')) { $node=$pkg.SelectSingleNode("*[local-name()='$name']"); if($node) {$local.AppendChild($xmlDoc.ImportNode($node,$true))|Out-Null} }
    $xmlDoc.Save((Join-Path $target 'package.xml'))
  }
}
$licenses=Join-Path $sdkRoot 'licenses';New-Item -ItemType Directory -Force -Path $licenses|Out-Null
# SDK license hashes used by the official package manager.
@('8933bad161af4178b1185d1a37fbf41ea5269c55','d56f5187479451eabf01fb78af6dfcb131a6481e','24333f8a63b6825ea9c5514f83c2829b004d1fee') | Set-Content -LiteralPath (Join-Path $licenses 'android-sdk-license') -Encoding ascii
$gradleZip=Join-Path $toolsRoot 'gradle-8.13-bin.zip'
if (!(Test-Path -LiteralPath (Join-Path $toolsRoot 'gradle-8.13\bin\gradle.bat'))) {
 Download 'https://downloads.gradle.org/distributions/gradle-8.13-bin.zip' $gradleZip
 if ((Get-FileHash -LiteralPath $gradleZip -Algorithm SHA256).Hash -ne '20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78') {throw 'Gradle checksum mismatch'}
 Expand-Archive -LiteralPath $gradleZip -DestinationPath $toolsRoot
}
'sdk.dir=.toolchain/android-sdk' | Set-Content -LiteralPath (Join-Path $projectRoot 'local.properties') -Encoding ascii
Write-Output "Toolchain ready: $sdkRoot"
