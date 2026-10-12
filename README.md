# Chartelis

留白之间，自在书写。基于 **Tauri 2 + React + TypeScript + Milkdown + Motion** 的 Windows / macOS Markdown 编辑器原型。

## 已实现

- 原生文件对话框：打开、保存、另存为 Markdown；支持中文文件名。
- Milkdown 即时排版：标题、粗体、斜体、删除线、引用、列表、代码、GFM 表格。
- 双模式编辑：Milkdown 即时预览 / CodeMirror 6 Markdown 源码，支持语法高亮、行号、括号匹配与自动换行。
- 每篇打开的文稿保留独立编辑会话：切换文稿时恢复编辑模式、光标/选区、滚动位置及撤销/重做历史。
- Motion 侧栏展开/收起、选区浮动工具栏、界面提示动画；遵循系统减少动态效果设置。
- 多文稿切换、文稿名称搜索、可跳转大纲、专注模式。
- 标准亮色 / 暗色 / 跟随系统，另外提供五种可选配色；宋体/黑体切换与字号设置。
- Ctrl/Cmd 快捷键、未保存标记、关闭前保存确认、恢复草稿。
- 保存时检查外部变更，拒绝静默覆盖；保留原文件 CRLF/LF 和 UTF-8 BOM。
- 使用用户提供的图标，生成 Windows ICO 与 macOS ICNS。

## 菜单、偏好与公式

- 侧栏顶部为「文件 / 编辑 / 视图 / 帮助」四宫格菜单，设置按钮位于品牌右侧。
- 文稿列表支持简洁 / 详细两种显示；详细模式显示两行正文摘要。
- 标准外观：亮色、暗色、跟随系统。跟随系统实时响应外观变化；可选配色为晨光、苔绿、雾蓝、玫瑰、深海。偏好随重启恢复。
- 设置中可配置 Markdown 默认打开应用。支持 Explorer / Finder 打开 `.md`、`.markdown`、`.mdown`，已打开文稿会复用编辑会话，保留未保存内容。
- 选区浮动工具栏可在设置中通过同款图标工具栏实时预览，点选图标后调整顺序或移除，下方图标面板切换显示的工具；全部移除即可隐藏。
- 右键 Markdown 格式菜单使用分组图标网格，悬停可查看名称，支持方向键操作。
- 顶栏导出按钮位于保存右侧；“视图 → 显示顶栏”可以隐藏或恢复顶栏，并记住重启前的选择。“另存为”保留在文件菜单及快捷键中。
- 原生窗口标题显示 `Chartelis - 当前文件名`。
- 文件菜单支持新建、打开、文件夹内逐级浏览、最近文件、快速切换、磁盘重新加载（可撤销）、保存全部、属性、导出与关闭。
- 编辑菜单支持撤销重做、剪切复制粘贴、复制全文 Markdown/HTML、全选、格式与公式插入、源码查找替换。视图包含侧栏、大纲、只读、专注、状态栏、全屏、原生窗口置顶、字号。
- 帮助内置 Markdown 与 LaTeX 语法表，LaTeX 示例包含渲染效果。
- 使用 `$E=mc^2$` 写行内公式，或以独占一行的 `$$` 包围独立公式。点击公式修改源码，Esc 或 Ctrl/Cmd + Enter 返回正文。KaTeX 和字体打包在应用中，离线可用。
- 支持 [KaTeX 数学语法](https://katex.org/docs/supported)，不包含完整 `.tex` 文档编译。PDF/PNG 渲染公式；Word 将行内与独立公式转换成原生 Office Math（OMML），支持分式、上下标、根式、求和、积分、矩阵、分段、重音与上下横线。无效公式或不支持的 MathML 结构会明确报错，不会静默替换为源码。

## 工作区与导出

- 重启后自动恢复打开的文稿、活动文稿、各模式的光标/选区和滚动位置，以及未保存草稿。正常退出会保留草稿；主动关闭单篇未保存文稿仍需确认。
- 专注模式仅突出光标所在的实际视觉行，其余行淡化；侧栏独立控制。
- 右键提供 Markdown 格式：粗体、斜体、高亮（`==文字==`）、删除线、六级标题、正文、列表、任务、引用、表格、代码、链接、图片与分隔线。
- 设置可将大纲放在左侧标签页或独立右侧栏。
- 支持 PDF、PNG、Word（DOCX）导出。PDF 使用 A4 分页、内嵌 Noto Sans SC 和 KaTeX 字体的真实文字，正文、表格、代码与公式字形可选中和搜索；背景、边框、图片和伸缩公式线条保留为图像层。PNG 是浅色长图；Word 保留可编辑正文、标题、行内样式、表格、列表、代码和原生公式，图片仍以链接形式表示。
- 图片导出最长 30,000 像素，超长文稿请用分页 PDF。外部图片受网络与跨域访问限制。

## 开发

推荐 Node.js 24、pnpm（版本见 package.json）、Rust stable。

Windows 需要 Visual Studio C++ Build Tools / Windows SDK 和 WebView2。macOS 需要 Xcode Command Line Tools。详细要求见 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)。

```sh
pnpm install --frozen-lockfile
pnpm desktop
```

桌面开发会自动启动 Vite。不要在另一个终端同时运行占用 1420 端口的 `pnpm dev`。

只看浏览器预览：

```sh
pnpm dev
```

访问 http://127.0.0.1:1420 。支持 File System Access API 的浏览器可以原地保存；其他浏览器使用文件选择和下载副本。下载副本不会将文稿标成已保存，恢复草稿会继续保留。

本机的 `.env.local` 配置复用了已有 Rust 安装，它已被 gitignore 排除。其他机器使用正常 PATH 中的 Rust 即可；非标准安装也可在该文件中指定 `CARGO_HOME`、`RUSTUP_HOME`。启动器位于 `scripts/desktop.mjs`，不修改系统环境变量。

## 验证与打包

```sh
pnpm test
pnpm build
pnpm desktop:build --bundles nsis  # Windows
pnpm desktop:build --bundles dmg   # macOS，需在 Mac 上执行
```

启动开发服务器后，可运行 `node e2e/verify-toolbar-ui.mjs`，验证工具栏预览与真实选区一致、右键格式操作保留选区、导出入口及顶栏显示偏好恢复。测试使用独立浏览器上下文，不修改正在使用的工作区。

Windows 输出位于 `src-tauri/target/release/bundle/nsis/`。

项目包含 `.github/workflows/build.yml`：Windows NSIS，以及同时兼容 Intel / Apple Silicon 的 macOS universal DMG 构建。工作流只生成构建产物，不发布 release。macOS 使用 ad-hoc 签名作为原型构建配置；正式分发需配置 Developer ID 签名与公证。Windows 原型未配置代码签名。

## 结构

```text
src/App.tsx              文稿状态、布局、快捷键、关闭保护
src/Editor.tsx           Milkdown 生命周期、选区工具栏、大纲
src/SourceEditor.tsx     CodeMirror 源码编辑、选区与历史
src/DocumentSession.tsx  每篇文稿的双视图、模式同步、位置恢复
src/workspace.ts         工作区持久化、校验和旧草稿迁移
src/AppMenu.tsx          四宫格菜单与次级菜单
src/Settings.tsx         配色、摘要与工具栏配置
src/math.ts              LaTeX 解析、节点编辑与离线渲染
src/ReferenceSheet.tsx   Markdown / LaTeX 语法表
src/focus-line.ts        视觉行定位
src/FormatMenu.tsx       格式菜单、链接/图片输入
src/export.ts           PDF / PNG / Word 导出
src/source-state.ts      源码状态、差异更新、源码大纲
src/document.ts          文稿模型、编码与恢复草稿
src/files.ts             原生/浏览器文件适配器、外部修改检查
src/styles.css           界面、主题、布局
src/editor.css           Markdown 排版
src-tauri/               Tauri Rust 入口、权限与打包配置
public/icon.png          原始软件图标
```

文件系统权限只开放读写命令，由系统打开/保存对话框授权具体文件或选定文件夹；文件关联仅授权系统传入的现存 Markdown 文件，没有授予前端全盘访问范围。Tauri persisted-scope 插件保留已授权文件的访问范围，重启后可继续保存这些文件。

## 编辑模式与会话

底栏左侧单按钮切换“即时预览”和“Markdown 源码”，或按 `Ctrl/Cmd + Shift + M`。两种模式都可编辑、保存，侧栏大纲会跟随当前模式跳转。`Ctrl/Cmd + Z` 撤销，`Ctrl/Cmd + Shift + Z` 重做；Windows 源码模式也支持 `Ctrl + Y`。

每篇文稿的两个视图各自记录光标、选区和滚动位置。切换文稿只是隐藏视图，关闭文稿才销毁会话。两个模式各自保留编辑历史；另一模式的修改在进入当前模式时作为一个独立的可撤销同步步骤加入，不清空已有历史。

仅切换模式或查看预览不重新序列化原文，因此源码中的列表标记、空行等格式会保留。在预览模式中实际修改正文后，会使用 Milkdown 的 Markdown 序列化规则；撤销回导入状态时恢复对应原始源码。

## 原型边界

- 已编辑文稿由 Milkdown 重新序列化，可能规范化列表标记、空行等格式。未编辑文稿保存时保留原始文件内容。尚未承诺任意 Markdown 扩展、HTML、YAML front matter 的无损往返；建议使用标准 CommonMark/GFM 文档。
- 光标和滚动位置会跨重启恢复；撤销/重做历史仅在当前运行会话中保留。打开很多长文稿会增加内存占用。
- 工作区快照保存在本地 WebView 存储中，不自动写回文件，也不是长期备份；缓存容量不足会提示并阻止静默退出。恢复的是最后的编辑快照，原文件被外部修改时仍由保存冲突检测保护。清理应用数据会删除工作区；浏览器文件句柄不能跨重启恢复，需重新选择保存位置。
- 保存前的外部修改检测不是文件锁；尚无原子保存、文件历史、多实例协作及自动更新。
- 暂未实现本地相对图片资源解析、附件管理、Mermaid 和常驻文件夹树。
- macOS 打包配置已准备，但当前 Windows 环境不能替代 Mac 真机与中文输入法测试。

## 测试记录

- TypeScript + Vite 生产构建通过，40 项单元/集成测试通过。
- 工作区测试覆盖文件基线、未保存草稿、文稿顺序、模式、光标、滚动、损坏数据与存储失败。
- 新增测试覆盖公式渲染、修改、撤销、模式往返、只读保护与工具栏偏好校验。
- 导出测试验证安全 HTML 和包含可编辑文本、样式、表格的 Word OOXML。
- 文稿状态测试覆盖异步保存期间的新修改、编码与换行保留。
- 文件适配器测试覆盖打开、取消、外部修改冲突、保存失败与未编辑源码保留。
- 双模式集成测试覆盖原始 Markdown 无修改往返、视图实例不重建、选区与滚动记忆、源码同步、两个模式的撤销与重做。
- 浏览器验证：60 节长文稿在源码与预览模式切换文稿后恢复相同滚动偏移和光标，两个模式分别保留位置，控制台无错误。
- 浏览器人工自动化验证：中文编辑、切换文稿、选区工具栏、修改标题、撤销、侧栏。
- Windows Tauri 原生验证：系统对话框打开中文路径文件、编辑中文、Ctrl+S 保存，并从磁盘读回核对。
- Windows 新菜单验证：系统标题随中文文件名更新；选定文件夹后可打开其中的 Markdown 并渲染公式；菜单复制全文与粘贴纯文本成功。
- Windows 重启验证：未保存内容、源码模式与光标恢复，原文件未被自动覆盖；重启后仍能保存到已授权路径。
- Windows 导出验证：PDF、PNG、DOCX 均通过系统对话框写入磁盘；PDF/PNG 渲染核对中文、表格、高亮与代码，DOCX 核对可编辑文本、表格与样式。

本项目目前为 0.1.2 原型；请先在副本文稿上体验。

### 导出验证与限制

- PDF 保留浏览器的换行和公式布局；分页避开表格行、独立公式和短代码块，超高内容允许跨页。PDF 中文字体完整嵌入以避免部分阅读器的子集字体缺字，因此文件体积通常约 6–13 MB；公式复制时的字符顺序由阅读器决定，不会转换回 LaTeX。
- Word 使用 A4 纸张、标题随正文、表头跨页重复和代码块缩进/底色；Word 自身会重新分页，无法保证与 PDF 的页码和字距完全一致。
- 字体许可与来源见 public/fonts/OFL.txt 和 public/fonts/README.txt。全部公式与字体转换在本机完成。
- pnpm test 包含 OMML 结构、无效公式和分页边界检查。启动 pnpm dev 后运行 node e2e/verify-exports.mjs，可在独立 Edge 浏览器上下文生成 artifacts/export-qa.pdf、.docx、.png；不会访问或修改当前工作区草稿。
- 使用 e2e/verify-pdf.py 可提取 PDF 中英文、代码和跨页表格文本并渲染逐页预览（需要 pypdf、pypdfium2）。本次使用 Microsoft Word 验证 7 个原生公式和 2 个表格，并渲染检查；macOS 尚未实机验证。
- 正式 Windows 包回归：通过系统文件对话框导出 native-export-qa.pdf 与 .docx；PDF 中文、英文、代码和末段文本提取通过，DOCX 核对 7 个 OMML 公式；安装包约 15.12 MiB。
