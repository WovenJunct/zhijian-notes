param([ValidateSet('emulator','image')][string]$Part)
$ErrorActionPreference='Stop';$root=Split-Path $PSScriptRoot -Parent;$tools=Join-Path $root '.toolchain';$sdk=Join-Path $tools 'android-sdk'
if($Part -eq 'emulator'){
 [xml]$repo=Get-Content -LiteralPath (Join-Path $tools 'repository.xml');$p=$repo.SelectNodes('//*[local-name()="remotePackage"]')|Where-Object {$_.path -eq 'emulator' -and $_.channelRef.ref -eq 'channel-0'}|Select-Object -First 1
 if(!$p){throw 'No stable emulator in official repository'};$archive=$p.archives.archive|Where-Object {$_.'host-os' -eq 'windows'}|Select-Object -First 1;$base='https://dl.google.com/android/repository/';$dest=$sdk
}else{
 [xml]$repo=Get-Content -LiteralPath (Join-Path $tools 'system-images.xml');$p=$repo.SelectNodes('//*[local-name()="remotePackage"]')|Where-Object {$_.path -eq 'system-images;android-36;default;x86_64'}|Select-Object -First 1;$archive=$p.archives.archive|Select-Object -First 1;$base='https://dl.google.com/android/repository/sys-img/android/';$dest=Join-Path $sdk 'system-images\android-36\default';New-Item -ItemType Directory -Force -Path $dest|Out-Null
}
$zip=Join-Path $tools $archive.complete.url
if(!(Test-Path -LiteralPath $zip)){& curl.exe -fsSL --retry 2 --connect-timeout 20 --max-time 600 ($base+$archive.complete.url) -o $zip;if($LASTEXITCODE){throw 'Emulator package download failed'}}
if((Get-FileHash -LiteralPath $zip -Algorithm SHA1).Hash -ne $archive.complete.checksum.InnerText){throw 'Emulator checksum mismatch'}
[System.IO.Compression.ZipFile]::ExtractToDirectory($zip,$dest,$true)
Write-Output "$Part prepared at $dest"
