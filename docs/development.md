# 开发与测试

## 构建

构建脚本面向 Windows 与 PowerShell 7。推荐安装 JDK 17 或 JDK 21，配置 `JAVA_HOME`，确认该目录下有 `bin/java.exe` 和 `bin/javac.exe`。

```powershell
.\scripts\setup.ps1
.\scripts\build.ps1 -Debug
.\scripts\build.ps1 -Release
```

调试包在 `app/build/outputs/apk/debug/`，安卓测试包在 `app/build/outputs/apk/androidTest/debug/`，正式安装包在 `dist/`。

项目固定使用 Android SDK 36、Android Gradle Plugin 8.13.2 和 Gradle 8.13。`setup.ps1` 将工具下载到 `.toolchain/` 并验证校验值；首次 Gradle 构建仍需要下载 Maven 依赖。应用运行所需前端资源已经包含在源码中。

脚本使用 `JAVA_HOME`，也接受 `-JavaHome` 参数。项目路径包含非 ASCII 字符时，`build.ps1` 会创建临时目录别名以规避 Windows 参数文件编码问题，不移动源文件；可通过 `-BuildAlias` 指定临时别名位置。

## 单元测试

```powershell
.\scripts\test-core.ps1
node --test tests/unit/*.test.mjs
```

Java 测试覆盖数据校验、归档安全、图片引用、合并恢复、导出及查询统计；Node 测试覆盖保存会话与异步桥回应。

## 界面测试与截图

```powershell
npm install --no-save playwright
npx playwright install chromium
node tests/e2e/run.mjs
node tests/e2e/editor-upgrade.mjs
node tests/e2e/organize-upgrade.mjs
node tests/e2e/images-upgrade.mjs
node tests/e2e/canvas-workshop.mjs
node tests/e2e/knowledge-upgrade.mjs
node tests/e2e/note-files.mjs
node tests/e2e/reminders-upgrade.mjs
node scripts/screenshots.mjs
```

默认使用 Playwright 管理的 Chromium。可选配置 `PAPER_CHROME` 指向自己的 Chromium/Chrome 可执行文件；`PAPER_NODE_MODULES` 可指定已有依赖目录。截图脚本使用虚构数据，将图片写入 `docs/images/`，不会读取真实用户记录。

浏览器流程的原生桥为测试替身，不能代替 Android 数据库、文件选择器与生命周期测试。

## 安卓测试

只使用专门的测试模拟器：测试会创建、恢复和删除示例数据。先构建、安装 debug 与 androidTest APK。Android 13 及以上需给测试包目标应用允许通知，才能验证实际通知发布与取消；随后执行：

```powershell
$env:PAPER_ANDROID_SERIAL = Read-Host '测试模拟器序列号'
adb -s $env:PAPER_ANDROID_SERIAL shell am instrument -w app.zhijian.notes.test/androidx.test.runner.AndroidJUnitRunner
node tests/android/upgrade.mjs
node tests/android/media.mjs
node tests/android/saf.mjs
```

脚本要求显式指定 `PAPER_ANDROID_SERIAL`，不会自动挑选设备。ADB 默认使用标准端口；`PAPER_ADB_PORT` 可指定独立服务端口，`PAPER_ADB` 可指定 ADB 可执行文件，`ANDROID_SDK_ROOT` 可指定 SDK 目录。测试 WebView 调试仅在 debug 包中启用。

`tests/android/release-upgrade.mjs --reset-test-app` 用于专用、可清空的测试模拟器，会先删除该应用的数据，再安装旧版、写入示例并覆盖安装新版。不要在个人手机运行。可用 `PAPER_UPGRADE_FROM_APK` 与 `PAPER_UPGRADE_TO_APK` 指定两个测试安装包。

## 安装包检查

运行 `scripts/verify.ps1` 检查正式包签名、最低系统版本、联网权限、离线资源、依赖校验值与私有构建文件排除。其他版本可通过 `-Apk` 传入项目相对路径。
