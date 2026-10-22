# macOS 真机测试

## 安装

1. 在 [GitHub Releases](https://github.com/Mclarenlife/Chartelis/releases) 下载最新测试版的 `Chartelis_版本号_universal.dmg`。
2. 打开 DMG，将 Chartelis 拖入「应用程序」，推出磁盘映像，再从「应用程序」启动。
3. 测试包支持 macOS 12 及以上，同时包含 Apple Silicon 和 Intel 架构。包使用 ad-hoc 签名，尚未经过 Apple Developer ID 签名和公证。若 macOS 阻止首次打开，可在「系统设置 → 隐私与安全性」中对这份已确认来源的测试包选择「仍要打开」。不需要关闭整个系统的安全检查。

## 建议验证

- 系统语言设为简体中文、繁体中文或英文，完全退出后重新启动 Chartelis，打开文件、打开文件夹、另存为及导出时，确认系统对话框按钮和路径控件跟随系统语言。应用内编辑界面仍使用中文。
- 红黄绿窗口按钮与 Chartelis 顶栏位于同一行，没有额外的标题文字栏；拖动顶栏空白及品牌区域可以移动窗口，菜单和设置按钮仍能正常点击。
- 收起顶栏后保留窗口按钮、拖动区域与展开按钮；验证最小窗口宽度、亮暗色、全屏进入/退出和文稿切换后，窗口按钮不会遮住内容。

- 中文输入法、选区、撤销重做、源码与即时预览切换。
- 设置中选「跟随系统」，切换 macOS 亮色/暗色，应立即同步；手动亮色/暗色和可选配色应保持选择。
- 保存含中文名、空格的 Markdown 文稿，退出重启，确认草稿、模式、光标和滚动位置恢复。
- 设置 → 默认打开方式 → 设为默认应用；如 macOS 要求确认请完成。也可以在 Finder 选一个 `.md` 文件 → 显示简介 → 打开方式选择 Chartelis → 全部更改。
- 分别在应用关闭和已运行时从 Finder 双击 Markdown；已编辑且未保存的同一文稿应被选中，草稿不被磁盘内容替换。
- 导出 PDF，搜索中文并选中文字；用 Word 打开 DOCX，点击分式、根式、矩阵确认是可编辑公式。

## 本地构建

安装 Node.js 24、项目指定版本的 pnpm、Rust stable、Xcode Command Line Tools 后：

```sh
pnpm install --frozen-lockfile
rustup target add aarch64-apple-darwin x86_64-apple-darwin
APPLE_SIGNING_IDENTITY=- pnpm desktop:build --target universal-apple-darwin --bundles dmg
```

输出：`src-tauri/target/universal-apple-darwin/release/bundle/dmg/`。

Windows 在设置中点击默认应用按钮会注册 Chartelis 并打开系统默认应用页面；仍需在系统页面确认 `.md` 的默认程序。应用不修改 Windows 受保护的 UserChoice。
