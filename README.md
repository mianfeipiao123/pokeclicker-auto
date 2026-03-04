# PokéClicker 简体中文翻译脚本

为 [PokéClicker](https://www.pokeclicker.com/) 游戏提供简体中文翻译的油猴脚本。

## 安装方法

### 1. 安装 Tampermonkey 扩展

根据你使用的浏览器，安装对应的 Tampermonkey 扩展：

- [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. 安装脚本

点击下方链接安装脚本：

- bundle-only（只加载 `bundle.json`，请求更少）  
  **[点击安装脚本（bundle-only）](https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/pokeclicker-zh-hans.bundle-only.user.js)**

## 使用说明

安装完成后，访问 [pokeclicker.com](https://www.pokeclicker.com/) 即可自动生效，游戏界面将显示为简体中文。

## 桌面端汉化

如果你使用的是 [PokéClicker Desktop](https://github.com/RedSparr0w/pokeclicker-desktop) 桌面客户端，可以通过以下方式启用中文翻译：

### 使用方法

1. 下载 [`inject-desktop-translation.bat`](./inject-desktop-translation.bat)
2. 双击运行（可放在任意位置）
3. 启动 PokéClicker Desktop

### 注意事项

- 首次加载需要网络连接（下载翻译数据约 1.4MB）
- 翻译数据会缓存到本地，后续启动更快
- **游戏更新后需重新运行注入脚本**

### 恢复原版

脚本会自动备份原文件。如需恢复英文版，运行：

```batch
copy "%APPDATA%\pokeclicker-desktop\pokeclicker-master\docs\index.html.backup" "%APPDATA%\pokeclicker-desktop\pokeclicker-master\docs\index.html"
```



## 问题反馈

如遇到翻译问题或有建议，请在 [GitHub Issues](https://github.com/mianfeipiao123/pokeclicker-auto/issues) 提交反馈。
