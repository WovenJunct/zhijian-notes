# 数据格式与架构

原生 Java Activity 管理 Android 生命周期、系统返回键、窗口边距与 WebView。所有页面来自应用内的 `paper.local` 本地来源，资源与图片由受限请求拦截器提供；应用没有联网权限。

界面通过白名单 JSON 桥调用原生服务。数据库和归档操作在串行后台执行器中处理，结果异步返回；界面根据确认回应更新保存状态。

| 组件 | 职责 |
| --- | --- |
| `MainActivity` / `LocalContentClient` | 生命周期、本地页面与附件访问边界 |
| `NativeBridge` / `DocumentController` | 命令校验、异步回应和系统文件选择器 |
| `PaperDb` / `RecordValidator` | SQLite 读写、软删除、批量事务与字段校验 |
| `NoteQueries` | 排序、首行摘要、日期筛选及本地统计 |
| `Editor` / `EditorTools` / `SaveSession` | 编辑会话、工具面板、选择区、历史与自动保存 |
| `content.js` | HTML 清洗、Markdown 预览、纯文本提取与格式转换 |
| `NoteImages` / `CanvasWorkshop` | 图片布局、像素编辑与离线手写画板 |
| `NoteUtilities` / `NoteKnowledge` / `NoteHistory` | 长文工具、笔记链接、模板与有界历史 |
| `NoteFileStore` / `NoteFileProvider` / `ShareImporter` | 私有附件、只读 URI 授权与系统分享导入 |
| `ReminderScheduler` / `ReminderReceiver` | 本地提醒调度、通知权限、过期任务核对与去重 |
| `ArchiveCodec` / `MergePlanner` / `BackupService` | 备份校验、附件引用、合并规划与恢复 |

## 本地存储

数据库版本为 1，使用稳定 UUID 标识笔记、文件夹与待办。记录包含创建、更新与删除时间；删除首先写入软删除状态，永久删除只允许作用于回收站记录。

正文、分类与标签保存在应用私有 SQLite 数据库中。图片复制到私有附件目录，以 `media/<UUID>.<ext>` 引用，不依赖原相册文件的长期访问权限。显示偏好使用原生 SharedPreferences，正文不存入浏览器存储。

文件附件以 `media/<UUID>.bin` 保存，名称、类型和大小写入笔记的 `attachments`。二进制文件不提供给 WebView；外部阅读器通过临时只读授权访问。历史存于 `_history`，采用 12 版 / 1.5 MiB 上限，历史图片及附件参与备份与清理引用收集。读取正文使用绑定参数的 SQLiteStatement，游标只读取 ID，避免大笔记与历史超过 CursorWindow 的单行容量。

自动保存按修订顺序提交，较旧确认不会将较新内容标为已保存。未确认草稿另写入应用私有恢复文件；写入失败时保留内容并提示重试。

## 备份与恢复

ZIP 根目录包含 `manifest.json`，图片位于 `media/`。清单包含 `format: "paper-notes"`、`version: 1`、笔记、文件夹、待办及附件校验值。

恢复先验证条目、大小、路径和附件校验值，再规划合并。相同 UUID 且内容一致的记录跳过，有差异的记录作为副本导入。数据库变更在事务中完成，失败时回滚并清理本次新增附件。

完整备份保留两种编辑类型的原始正文、分类、标签、收藏、置顶及回收站状态。Markdown ZIP 是可阅读的导出格式，不能代替完整备份用于无损迁移。

## 格式与限制

- 图文保存经过清洗的 HTML，保留受控颜色、对齐、列表和表格元数据。Markdown 保留源文；两种类型不直接互转。
- 导出 `.md` 与 `media/` 并列，保留相对图片引用。标准 Markdown 不保证还原颜色、高亮和对齐。
- 图片支持 JPG、PNG、WebP、GIF，单图最大 20 MiB、4,000 万像素；不支持 SVG。
- 像素编辑画布最长边 2048、最多约 200 万像素；输出 PNG，不覆盖原文件。
- 文件附件每个 20 MiB、每条笔记最多 50 个，系统分享单次最多 10 个。
- 备份最多 1 GiB 解压内容、10,000 个文件，清单最大 32 MiB；超限会报告失败。
- 批量整理一次最多 1,000 条笔记；日期回顾按本地创建日期统计，排除回收站。
