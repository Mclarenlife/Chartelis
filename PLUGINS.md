# Chartelis 插件 API v1

首版插件是 UTF-8 JSON 文件，推荐命名 `name.chartelis-plugin.json`。可贡献主题、文稿模板、选区命令，不执行 JavaScript、Rust、HTML 或任意 CSS。无需单独打包 Windows / Mac 版本。尚无在线插件市场、第三方代码运行时或网络/文件 API。

## 安装和使用

设置 → 插件管理 → 导入插件包 → 查看内容 → 安装。也可直接查看并安装内置「写作工具箱」示例。插件包保存在当前设备的应用本地存储，重启恢复；浏览器预览与桌面应用的存储相互独立。

- 主题：设置 → 插件主题。停用、卸载或更新移除当前主题时，恢复「跟随系统」。
- 模板：文件 → 从模板新建。创建独立的未保存草稿，不写磁盘，不覆盖当前文稿；之后使用正常保存功能。
- 命令：选中文字 → 编辑 → 插件选区命令。作用于当前编辑模式的选区，可撤销、重做；只读时禁用，空选区给出提示。即时预览处理所选纯文本，源码模式处理原始字符；不承诺保留选区内部的复杂富文本结构。包裹或前缀中的 Markdown 标记在预览模式按普通文本插入，不作为格式指令解析。

导入同 ID 的插件需明确确认替换（支持升级或回退），保持原启停状态。卸载不会删除已创建的文稿。损坏的插件存储停止加载，可先导出原始备份再重置；备份用于恢复诊断，不是单插件安装包。

## 最小插件

```json
{
  "apiVersion": 1,
  "id": "yourname.text-tools",
  "name": "我的文字工具",
  "version": "1.0.0",
  "author": "你的名字",
  "description": "为选中文字添加中文引号",
  "commands": [
    { "id": "quote", "name": "加中文引号", "operation": "wrap", "before": "“", "after": "”" }
  ]
}
```

完整示例：[写作工具箱](examples/plugins/writing-kit.chartelis-plugin.json)。修改文件后在设置中重新导入即可更新，不需重新构建应用。

## 字段

顶层必须包含 `apiVersion: 1`、`id`、`name`、`version`、`author`；`description` 可省略。`themes`、`templates`、`commands` 为可选数组，至少有一项贡献。插件 ID 在安装列表中唯一；贡献 ID 在同类数组内唯一。ID 使用小写字母、数字、点、连字符，以字母开始。版本为 `1.0.0` 或 `1.0.0-beta.1`。

### 主题

每项包含 `id`、`name`、`appearance`（`light` 或 `dark`）和 `colors`。
`colors` 必须完整提供：`paper`、`sidebar`、`text`、`muted`、`subtle`、`line`、`hover`、`selected`、`accent`、`accent-soft`、`gold`、`surface`。色值只允许 `#RRGGBB`；不可注入 CSS、URL、字体或脚本。主题 ID 由宿主加上插件命名空间，不覆盖内置主题。

### 模板

每项包含 `id`、`name`、`filename`、`markdown`。文件名必须以 `.md` 结尾且不包含路径。正文支持 `{{date}}`（本地日期 YYYY-MM-DD）和 `{{time}}`（HH:mm）；文件名支持 `{{date}}`。其余占位符保留原样，不执行表达式。

### 选区命令

每项包含 `id`、`name`、`operation`，按操作类型填写额外字段：

| operation | 参数 | 行为 |
| --- | --- | --- |
| uppercase | 无 | 转大写 |
| lowercase | 无 | 转小写 |
| trim | 无 | 删除整个选区首尾空白 |
| wrap | before、after | 包裹文字，允许空字符串 |
| prefixLines | prefix | 每行增加相同前缀 |
| replace | search、replacement | 全部按字面替换；search 非空，无正则表达式 |

## 限制和验证

单包最大 256 KB，最多安装 20 个插件，每类贡献最多 20 项。单个模板正文最多 50,000 个 UTF-16 代码单元；单次选区输入最多 100,000，输出最多 200,000。未知字段、未知操作和不兼容 API 版本拒绝导入。

插件声明的作者和版本只是元数据，当前没有发行者身份认证。宿主对包内容进行严格校验，只执行固定操作。API v1 插件无需也无法申请网络、全盘文件访问或系统命令权限。模板成为普通文稿后遵循编辑器现有的 Markdown 渲染规则，包括加载远程图片；插件本身没有网络 API。后续如引入脚本插件，将另行设计隔离运行时和显式权限 API。
