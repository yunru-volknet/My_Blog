# YUNRU // FOEHN ARCHIVE

以《红色警戒 2：尤里的复仇》Mental Omega 模组“焚风反抗军”为视觉灵感的 Hugo 技术博客。

## 本地预览

需要 Hugo Extended 0.128 或更高版本：

```powershell
hugo server --source .\yunru-blog --baseURL http://127.0.0.1:1313/ --bind 127.0.0.1 --port 1313
```

浏览器访问 [http://127.0.0.1:1313/](http://127.0.0.1:1313/)。

## 构建

```powershell
hugo --source .\yunru-blog --minify --cleanDestinationDir
```

推送到 `main` 分支后，GitHub Actions 会自动构建并发布 GitHub Pages。

## 一键发布 Markdown 文章

Windows 上双击 `tools\Start-PostPublisher.ps1`，或在 PowerShell 运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Start-PostPublisher.ps1
```

然后访问 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)，拖入或选择 `.md` 文件，确认预览后点“上传并发布”。工具会将文章保存到 `yunru-blog/content/posts/` 并推送源码仓库，然后在本机生成网站，将成品推送到博客根域名仓库 `yunru-volknet/yunru-volknet.github.io`。已有 Hugo front matter 会原样保留；没有 front matter 时会自动补上标题、上海时区日期和 `draft = false`。

发布器只绑定 `127.0.0.1`，不向公开站点开放上传接口。运行前需要 Node.js 20+、Hugo Extended 0.128+、Git、对源码仓库和根站点仓库的 GitHub SSH 推送权限，以及干净的 `main` 工作区。源码仓库的旧 `/My_Blog/` Pages 工作流已改为手动触发，文章发布由此工具更新到根域名。关闭运行发布器的 PowerShell 窗口即可停止服务。
