$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$vendor=Join-Path $root 'app\src\main\assets\web\vendor'
New-Item -ItemType Directory -Force -Path $vendor | Out-Null
$packages=@(@('quill','dist/quill.js','quill.js'),@('quill','dist/quill.snow.css','quill.css'),@('markdown-it','dist/browser/markdown-it.umd.min.js','markdown-it.js'),@('dompurify','dist/purify.min.js','purify.js'),@('turndown','dist/turndown.js','turndown.js'))
$locks=@();$resolved=@{}
foreach($p in $packages) {
 if(!$resolved.ContainsKey($p[0])) {
  $raw=& curl.exe -fsSL --max-time 40 ('https://registry.npmjs.org/'+$p[0]+'/latest');if($LASTEXITCODE){throw 'Registry unavailable'}
  $resolved[$p[0]]=($raw|ConvertFrom-Json).version
 }
 $version=$resolved[$p[0]];$url="https://cdn.jsdelivr.net/npm/$($p[0])@$version/$($p[1])"
 & curl.exe -fsSL --retry 2 --max-time 60 $url -o (Join-Path $vendor $p[2]);if($LASTEXITCODE){throw "Vendor download failed: $url"}
 $locks+=@{package=$p[0];version=$version;file=$p[2];url=$url;sha256=(Get-FileHash -LiteralPath (Join-Path $vendor $p[2]) -Algorithm SHA256).Hash.ToLowerInvariant()}
}
foreach($name in $resolved.Keys) {
 $licenseName=if($name -eq 'quill'){'LICENSE'}elseif($name -eq 'dompurify'){'LICENSE'}else{'LICENSE'}
 & curl.exe -fsSL --max-time 40 "https://cdn.jsdelivr.net/npm/$name@$($resolved[$name])/$licenseName" -o (Join-Path $vendor "$name-LICENSE.txt")
 if($LASTEXITCODE) { & curl.exe -fsSL --max-time 40 "https://cdn.jsdelivr.net/npm/$name@$($resolved[$name])/LICENSE.md" -o (Join-Path $vendor "$name-LICENSE.txt"); if($LASTEXITCODE){throw "Missing license: $name"} }
}
$nativeJar=Join-Path $root '.toolchain\test-libs\commonmark.jar';New-Item -ItemType Directory -Force -Path (Split-Path $nativeJar -Parent)|Out-Null
$nativeUrl='https://repo.maven.apache.org/maven2/org/commonmark/commonmark/0.21.0/commonmark-0.21.0.jar'
if(!(Test-Path -LiteralPath $nativeJar)){& curl.exe -fsSL --max-time 60 $nativeUrl -o $nativeJar;if($LASTEXITCODE){throw 'CommonMark download failed'}}
$jar=[IO.Compression.ZipFile]::OpenRead($nativeJar);try{[IO.Compression.ZipFileExtensions]::ExtractToFile($jar.GetEntry('META-INF/LICENSE.txt'),(Join-Path $vendor 'commonmark-java-LICENSE.txt'),$true)}finally{$jar.Dispose()}
$locks+=@{package='commonmark-java';version='0.21.0';file='commonmark-java-LICENSE.txt';url=$nativeUrl;sha256=(Get-FileHash -LiteralPath (Join-Path $vendor 'commonmark-java-LICENSE.txt') -Algorithm SHA256).Hash.ToLowerInvariant();artifactSha256=(Get-FileHash -LiteralPath $nativeJar -Algorithm SHA256).Hash.ToLowerInvariant()}
$locks | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $root 'vendor-lock.json') -Encoding utf8
$locks | Select-Object package,version,file
