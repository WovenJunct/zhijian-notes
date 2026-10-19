# 第三方许可

运行时不访问 CDN。下列前端库以固定版本随 APK 打包；完整许可文本也保存在安装包的 `assets/web/vendor/` 中。

| 库 | 固定版本 | 许可 | 随包许可文件 |
| --- | --- | --- | --- |
| Quill | 2.0.3 | BSD-3-Clause | quill-LICENSE.txt |
| markdown-it | 15.0.3 | MIT | markdown-it-LICENSE.txt |
| DOMPurify | 3.4.17 | Apache-2.0 或 MPL-2.0 | dompurify-LICENSE.txt |
| Turndown | 7.2.4 | MIT | turndown-LICENSE.txt |
| commonmark-java | 0.21.0 | BSD-2-Clause | commonmark-java-LICENSE.txt |

完整锁定清单和每个发行文件的 SHA-256 见 `vendor-lock.json`。图标使用本项目自绘的简单矢量路径；界面使用系统字体，不捆绑商业字体。

commonmark-java 用于原生备份和导出的图片引用识别，由 Gradle 编入 APK；其完整许可同样随包提供。JUnit、JSON-java 和 AndroidX Test 仅用于开发测试，不进入发布版 APK。Android SDK、Gradle 与 JDK 为本机构建工具，不进入源码交付 ZIP 或发布版应用。
