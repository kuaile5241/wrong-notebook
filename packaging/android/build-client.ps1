param(
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][string]$AndroidSdk,
    [Parameter(Mandatory=$true)][string]$Gradle,
    [Parameter(Mandatory=$true)][string]$SigningDirectory,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [string]$ServerUrl = 'http://115.159.150.79:3008',
    [ValidateSet('phone','tablet')][string]$Device = 'tablet',
    [string]$VersionName = '2026.10.29-1',
    [int]$VersionCode = 2026102901,
    [int]$CompileSdk = 35,
    [string]$BuildToolsVersion = '35.0.0',
    [string]$GradleInitScript
)
$ErrorActionPreference = 'Stop'
if ($VersionCode -lt 1) { throw '版本代码必须为正数' }
$endpoint = [Uri]$ServerUrl
if ($endpoint.Scheme -notin 'http','https' -or $endpoint.UserInfo -or $endpoint.Query -or $endpoint.Fragment) { throw '服务器地址无效' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$signing = [IO.Path]::GetFullPath($SigningDirectory)
if ($signing.StartsWith($repo + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '签名目录必须位于仓库外' }
foreach ($directory in @($SigningDirectory,$OutputDirectory)) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
$saved = @{}
foreach ($name in @('JAVA_HOME','ANDROID_HOME','PATH','ANDROID_KEYSTORE_FILE','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD')) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
function Invoke-Checked([string]$Executable,[string[]]$ToolArguments) {
    & $Executable @ToolArguments
    if ($LASTEXITCODE -ne 0) { throw "构建工具失败：$Executable，退出码 $LASTEXITCODE" }
}
try {
    $env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaHome).Path
    $env:ANDROID_HOME = (Resolve-Path -LiteralPath $AndroidSdk).Path
    $env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
    $env:ANDROID_KEYSTORE_FILE = Join-Path $signing 'rainbow-notebook-release.jks'
    $protected = Join-Path $signing 'password.dpapi'
    $env:ANDROID_KEY_ALIAS = 'rainbow-notebook'
    if (Test-Path -LiteralPath $protected) {
        $secure = (Get-Content -LiteralPath $protected -Raw).Trim() | ConvertTo-SecureString
        $env:ANDROID_KEYSTORE_PASSWORD = [Net.NetworkCredential]::new('', $secure).Password
    } elseif (!(Test-Path -LiteralPath $env:ANDROID_KEYSTORE_FILE)) {
        $env:ANDROID_KEYSTORE_PASSWORD = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
        $env:ANDROID_KEYSTORE_PASSWORD | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $protected -Encoding ascii
    } else { throw '签名密钥已存在，但没有本地受保护密码' }
    $env:ANDROID_KEY_PASSWORD = $env:ANDROID_KEYSTORE_PASSWORD
    if (!(Test-Path -LiteralPath $env:ANDROID_KEYSTORE_FILE)) {
        Invoke-Checked (Join-Path $env:JAVA_HOME 'bin/keytool.exe') @('-genkeypair','-storetype','JKS','-keystore',$env:ANDROID_KEYSTORE_FILE,'-alias',$env:ANDROID_KEY_ALIAS,'-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Rainbow Notebook, O=kuaile5241','-storepass:env','ANDROID_KEYSTORE_PASSWORD','-keypass:env','ANDROID_KEY_PASSWORD','-noprompt')
    }
    $variant = 'Client' + (Get-Culture).TextInfo.ToTitleCase($Device)
    $gradleArguments = @('-p',$PSScriptRoot,'--no-daemon','--max-workers=2',":app:assemble${variant}Release", "-PappVersionName=$VersionName", "-PappVersionCode=$VersionCode", "-PclientServerUrl=$ServerUrl", "-PandroidCompileSdk=$CompileSdk", "-PandroidBuildTools=$BuildToolsVersion")
    if ($GradleInitScript) { $gradleArguments += @('--init-script', (Resolve-Path -LiteralPath $GradleInitScript).Path) }
    Invoke-Checked $Gradle $gradleArguments
    $apk = Join-Path $PSScriptRoot "app/build/outputs/apk/client$((Get-Culture).TextInfo.ToTitleCase($Device))/release/app-client-$Device-release.apk"
    if (!(Test-Path -LiteralPath $apk)) { throw '未找到生成的客户端 APK' }
    $target = Join-Path $OutputDirectory "rainbow-notebook-$Device-$VersionName.apk"
    Copy-Item -LiteralPath $apk -Destination $target -Force
    $signer = Join-Path $env:ANDROID_HOME "build-tools/$BuildToolsVersion/lib/apksigner.jar"
    Invoke-Checked (Join-Path $env:JAVA_HOME 'bin/java.exe') @('-jar',$signer,'verify','--verbose','--print-certs',$target)
    [ordered]@{ package='com.kuaile5241.wrongnotebook'; server=$ServerUrl; version=$VersionName; versionCode=$VersionCode; device=$Device; sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLower(); bytes=(Get-Item -LiteralPath $target).Length; signed=$true; onlineWebUpdates=$true; realDeviceTested=$false } | ConvertTo-Json | Set-Content -LiteralPath ($target+'.json') -Encoding utf8
    Write-Output "已生成：$target"
} finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
}
