# Publishing the GitHub Wiki / 发布 GitHub Wiki

[English README](../README.md) · [中文 README](../README.zh-CN.md) · [Wiki](wiki/Home.md) · [中文 Wiki](wiki/Home-zh-CN.md)

## English

The Markdown files under `docs/wiki/` are readable in the main repository and included in the npm archive. They are also the source for the [published GitHub Wiki](https://github.com/leiyun-studio/hikvision-isapi/wiki). Use this workflow to synchronize future changes.

1. Use the project repository [leiyun-studio/hikvision-isapi](https://github.com/leiyun-studio/hikvision-isapi).
2. Enable **Wikis** in the repository settings, if available for your repository/account. In the **Wiki** tab, create and save an initial `Home` page to initialize its repository.
3. Clone the Wiki repository into a separate directory using the command below.
4. From the project root, export the pages using the PowerShell commands below. This converts relative `.md` links to Wiki page links and includes `_Sidebar.md`.
5. Review the Wiki changes, commit, and push from its directory. Open the Wiki and verify both language home pages and sidebar links.

GitHub stores Wiki pages separately from the main repository; pushing project files alone does not publish the Wiki. See [GitHub's guide to editing Wiki pages](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages).

## 简体中文

`docs/wiki/` 内的 Markdown 可直接在主仓库阅读，也会包含在 npm 包中，同时作为[已发布的 GitHub Wiki](https://github.com/leiyun-studio/hikvision-isapi/wiki/Home-zh-CN) 的源文件。后续文档更新可按以下流程同步。

1. 使用项目仓库 [leiyun-studio/hikvision-isapi](https://github.com/leiyun-studio/hikvision-isapi)。
2. 如果仓库和账号支持 Wiki，在仓库设置中启用 **Wikis**，进入 **Wiki** 页签，创建并保存初始 `Home` 页面，以初始化 Wiki 仓库。
3. 使用以下命令，将 Wiki 仓库克隆到独立目录。
4. 在项目根目录执行下列 PowerShell 命令，导出页面，并将相对 `.md` 链接转换为 Wiki 页面链接，同时导出 `_Sidebar.md` 侧边栏。
5. 在 Wiki 目录检查变更、提交并推送，随后打开 Wiki 核对两种语言的首页和侧边栏链接。

GitHub Wiki 与主仓库独立存储，仅推送项目不会自动发布 Wiki。具体机制见 [GitHub 官方说明](https://docs.github.com/zh/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages)。

## PowerShell

Run from the project root / 从项目根目录执行：

```powershell
git clone https://github.com/leiyun-studio/hikvision-isapi.wiki.git ../hikvision-isapi-wiki

$wikiTarget = (Resolve-Path -LiteralPath '../hikvision-isapi-wiki').Path
Get-ChildItem -LiteralPath './docs/wiki' -Filter '*.md' -File | ForEach-Object {
  $wikiText = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
  $wikiText = $wikiText -replace '\]\(([^):]+)\.md(#[^)]*)?\)', ']($1$2)'
  [System.IO.File]::WriteAllText(
    (Join-Path -Path $wikiTarget -ChildPath $_.Name),
    $wikiText,
    [System.Text.UTF8Encoding]::new($false)
  )
}

git -C ../hikvision-isapi-wiki diff
git -C ../hikvision-isapi-wiki status --short
git -C ../hikvision-isapi-wiki add -- '*.md'
git -C ../hikvision-isapi-wiki commit -m "docs: update bilingual SDK wiki"
git -C ../hikvision-isapi-wiki push
```

The export overwrites matching filenames, without removing other Wiki pages. For future updates, pull the Wiki repository first, review changes made online, update `docs/wiki/`, and export again. Keep the source and Wiki synchronized; remove renamed/retired pages manually after review.

导出会覆盖同名文件，不会删除其他 Wiki 页面。后续更新前，先拉取 Wiki 仓库并检查网页端修改，同步到 `docs/wiki/` 后重新导出。重命名或废弃页面需要审查后手动清理，避免留下旧页面。

Both READMEs link to the live Wiki and retain local documentation links. Updates to source files need a separate Wiki push to appear online.

两份 README 已提供在线 Wiki 入口，并保留本地文档链接。更新源文件后，需要单独推送 Wiki 仓库，线上页面才会更新。
