$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$publisher = Join-Path $PSScriptRoot "publisher.mjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "未找到 Node.js。请安装 Node.js 20 或更高版本后重试。"
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "未找到 Git。请安装 Git 并完成 GitHub SSH 登录后重试。"
}

if (-not (Get-Command hugo -ErrorAction SilentlyContinue)) {
  throw "未找到 Hugo Extended。请安装 Hugo Extended 0.128 或更高版本后重试。"
}

Set-Location -LiteralPath $repoRoot
Write-Host "焚风文章上传工具正在启动。浏览器访问 http://127.0.0.1:4173/" -ForegroundColor Cyan
Write-Host "上传成功后 GitHub Actions 会自动部署；按 Ctrl+C 可停止工具。" -ForegroundColor DarkGray
node $publisher
