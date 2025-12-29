# 翻译（最终输出）

此目录存放“可直接上传 GitHub，并由油猴脚本加载”的最终翻译产物：

- `locales/`：给游戏 i18n 系统加载（`?translations=`）
- `hardcoded/`：给油猴脚本做 DOM 文本替换
- `tampermonkey/`：油猴脚本（加载本目录内容）

## 生成（一次性全量机翻）

先确保已生成解析与加工模板：

```powershell
node .\\解析\\生成解析.mjs
node .\\加工\\生成翻译文件.mjs
```

然后生成本目录的“全量简体中文”：

```powershell
node .\\翻译\\生成完整翻译.mjs
```

生成完成后，把整个 `翻译/` 上传到 GitHub。

## 油猴脚本

安装：`翻译/tampermonkey/pokeclicker-zh-hans.user.js`

需要把脚本内的两处地址改成你自己的 GitHub：

- `TRANSLATIONS_PARAM_VALUE`：建议使用 `github:` 形式，并对 `翻译` 做 URL 编码（`%E7%BF%BB%E8%AF%91`），例如：
  - `github:YourName/YourRepo/main/%E7%BF%BB%E8%AF%91`
- `HARDCODED_MAP_URL`：指向 `翻译/hardcoded/zh-Hans.map.json` 的 raw 链接

## 注意

本目录的中文为**机器翻译**结果（使用 Google 翻译的公开接口），可先全量覆盖英文，再按需要逐步人工润色。

