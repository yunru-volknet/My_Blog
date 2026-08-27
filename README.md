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
