import { createServer } from "node:http";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "yunru-blog", "content", "posts");
const publicDir = path.join(root, "yunru-blog", "public");
const rootSiteRemote = "git@github.com:yunru-volknet/yunru-volknet.github.io.git";
const rootSiteUrl = "https://yunru-volknet.github.io/";
const port = Number(process.env.FOEHN_PUBLISHER_PORT || 4173);
const maxFileBytes = 3 * 1024 * 1024;
const maxRequestBytes = Math.ceil(maxFileBytes * 4 / 3) + 64 * 1024;
const page = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "publisher.html"));

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0
      ? resolve(stdout.trim())
      : reject(new Error((stderr || stdout || `${command} ${args[0]} failed`).trim())));
  });
}

const runGit = (args, cwd = root) => runProcess("git", args, cwd);

async function deployRootSite(title) {
  await runProcess("hugo", [
    "--source", path.join(root, "yunru-blog"),
    "--baseURL", rootSiteUrl,
    "--minify",
    "--cleanDestinationDir",
  ], root);

  const tempRoot = await mkdtemp(path.join(tmpdir(), "foehn-root-site-"));
  const checkout = path.join(tempRoot, "site");
  try {
    await runGit(["clone", "--depth", "1", rootSiteRemote, checkout], tempRoot);
    const branch = await runGit(["branch", "--show-current"], checkout);
    if (branch !== "main") throw new Error(`根站点当前分支是 ${branch || "(detached)"}，应为 main。`);
    await runGit(["rm", "-r", "--ignore-unmatch", "--", "."], checkout);
    for (const entry of await readdir(publicDir)) {
      await cp(path.join(publicDir, entry), path.join(checkout, entry), { recursive: true, force: true });
    }
    await runGit(["add", "-A"], checkout);
    await runGit(["commit", "-m", `Publish post: ${title.replace(/[\r\n]+/g, " ").slice(0, 100)}`], checkout);
    const deploymentCommit = await runGit(["rev-parse", "--short", "HEAD"], checkout);
    await runGit(["push", "origin", "main"], checkout);
    return deploymentCommit;
  } finally {
    const safeTempRoot = path.resolve(tmpdir(), path.basename(tempRoot));
    if (safeTempRoot === path.resolve(tempRoot) && safeTempRoot.startsWith(path.resolve(tmpdir()) + path.sep)) {
      await rm(safeTempRoot, { recursive: true, force: true });
    }
  }
}

function respond(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}

function slugify(value) {
  const slug = value.normalize("NFKC").toLocaleLowerCase("zh-CN")
    .replace(/\.md$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
  if (!slug || slug === "." || slug === "..") throw new Error("无法从文件名生成有效文章链接，请重命名 Markdown 文件后重试。");
  return slug;
}

function frontMatterInfo(content) {
  const match = content.match(/^\uFEFF?(\+\+\+|---)\r?\n([\s\S]*?)\r?\n\1(?:\r?\n|$)/);
  if (!match) return null;
  const block = match[2];
  const readField = key => {
    const field = block.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, "mi"));
    if (!field) return "";
    return field[1].trim().replace(/^(['"])([\s\S]*)\1$/, "$2");
  };
  return {
    title: readField("title"),
    slug: readField("slug"),
    draft: /^(?:draft\s*=\s*true|draft\s*:\s*true)\s*$/im.test(block),
  };
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxRequestBytes) throw new Error("文章文件超过 3 MB 限制。");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("上传内容格式不正确。");
  }
}

const server = createServer(async (req, res) => {
  const host = req.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/publisher.html")) {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.end(page);
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/publish") {
    respond(res, 404, { error: "未找到此接口。" });
    return;
  }

  const expectedOrigin = `http://${host}`;
  if (req.headers.origin !== expectedOrigin || !String(req.headers["content-type"] || "").startsWith("application/json")) {
    respond(res, 403, { error: "请求来源无效，请从本机发布器页面操作。" });
    return;
  }

  try {
    const body = await readJson(req);
    if (typeof body.filename !== "string" || !/\.md$/i.test(body.filename)) throw new Error("请选择 Markdown（.md）文件。");
    if (typeof body.content !== "string" || !body.content.trim()) throw new Error("文章内容不能为空。");

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(body.content)) throw new Error("上传编码无效，请重新选择文件。");
    const fileBytes = Buffer.from(body.content, "base64");
    if (fileBytes.length > maxFileBytes) throw new Error("文章文件超过 3 MB 限制。");
    let content;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(fileBytes); }
    catch { throw new Error("文件不是有效的 UTF-8 编码 Markdown。"); }
    content = content.replace(/^\uFEFF/, "");
    const metadata = frontMatterInfo(content);
    if (metadata?.draft) throw new Error("这篇文章的 front matter 标记为 draft = true，请先改成 false 再上传。");

    const fileBase = path.basename(body.filename, path.extname(body.filename));
    const fallbackTitle = fileBase.replace(/[-_]+/g, " ").trim();
    const title = metadata?.title || content.match(/^#\s+(.+)\s*$/m)?.[1]?.trim() || fallbackTitle;
    const slug = slugify(metadata?.slug || fileBase || title);
    const destination = path.join(postsDir, `${slug}.md`);
    if (!destination.startsWith(`${postsDir}${path.sep}`)) throw new Error("文章路径无效。");

    const branch = await runGit(["branch", "--show-current"]);
    if (branch !== "main") throw new Error(`当前分支是 ${branch || "(detached)"}；请切换到 main 分支后重试。`);
    const initialStatus = await runGit(["status", "--porcelain"]);
    if (initialStatus) throw new Error("仓库存在未提交改动。请先提交或暂存这些改动，再运行发布器，避免把其他文件一起推送。");
    await runGit(["pull", "--ff-only", "origin", "main"]);
    const status = await runGit(["status", "--porcelain"]);
    if (status) throw new Error("同步 main 分支后发现工作区有改动。请检查 Git 状态后重试。");

    let post = content;
    if (!metadata) {
      const date = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Shanghai",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      }).format(new Date()).replace(" ", "T") + "+08:00";
      post = `+++\ntitle = ${JSON.stringify(title)}\ndate = ${date}\ndraft = false\n+++\n\n${content.trimStart()}`;
    }

    await writeFile(destination, post.endsWith("\n") ? post : `${post}\n`, { flag: "wx" });
    const relativePath = path.relative(root, destination).split(path.sep).join("/");
    await runGit(["add", "--", relativePath]);
    await runGit(["commit", "-m", `Add post: ${title.replace(/[\r\n]+/g, " ").slice(0, 120)}`]);
    const commit = await runGit(["rev-parse", "--short", "HEAD"]);
    await runGit(["push", "origin", "main"]);
    let deploymentCommit;
    try {
      deploymentCommit = await deployRootSite(title);
    } catch (error) {
      throw new Error(`文章已推送到源码仓库（${commit}），但根站点发布未完成：${error instanceof Error ? error.message : "未知错误"}`);
    }

    respond(res, 200, {
      ok: true,
      title,
      slug,
      sourceCommit: commit,
      deploymentCommit,
      path: relativePath,
      url: `${rootSiteUrl}posts/${encodeURIComponent(slug)}/`,
      message: "文章已同步到博客源码和根域名站点。",
    });
  } catch (error) {
    respond(res, 400, { error: error instanceof Error ? error.message : "上传失败，请查看本机 Git 状态。" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`焚风文章发布器已启动：http://127.0.0.1:${port}/`);
  console.log("仅本机可访问。关闭此窗口即可停止服务。");
});

server.on("error", error => {
  console.error(`发布器启动失败：${error.message}`);
  process.exitCode = 1;
});
