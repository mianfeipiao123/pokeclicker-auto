@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo  PokéClicker Desktop 简体中文翻译注入
echo ========================================
echo.

:: 设置目标文件路径
set "TARGET_FILE=%APPDATA%\pokeclicker-desktop\pokeclicker-master\docs\index.html"
set "BACKUP_FILE=%APPDATA%\pokeclicker-desktop\pokeclicker-master\docs\index.html.backup"

:: 检查目标文件是否存在
if not exist "%TARGET_FILE%" (
    echo [错误] 找不到目标文件：
    echo        %TARGET_FILE%
    echo.
    echo 请确保已安装 PokéClicker Desktop 客户端。
    echo.
    pause
    exit /b 1
)

echo [1/3] 找到目标文件
echo      %TARGET_FILE%
echo.

:: 检查是否已经注入过
findstr /c:"pokeclicker-zh-hans.bundle-only.user.js" "%TARGET_FILE%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [提示] 翻译脚本已存在，无需重复注入。
    echo.
    pause
    exit /b 0
)

:: 备份原文件
echo [2/3] 备份原文件...
copy /y "%TARGET_FILE%" "%BACKUP_FILE%" >nul
if %errorlevel% neq 0 (
    echo [错误] 备份失败！
    pause
    exit /b 1
)
echo      已备份到: index.html.backup
echo.

:: 创建临时 PowerShell 脚本进行注入
echo [3/3] 注入翻译脚本...

powershell -ExecutionPolicy Bypass -Command ^
    "$content = Get-Content -Path '%TARGET_FILE%' -Raw -Encoding UTF8; " ^
    "$injection = \"`n    <!-- PokéClicker 简体中文翻译 -->`n    <script src=\"\"https://cdn.jsdelivr.net/gh/mianfeipiao123/pokeclicker-auto@main/pokeclicker-zh-hans.bundle-only.user.js\"\"></script>\"; " ^
    "$content = $content -replace '(<head[^>]*>)', \"`$1$injection\"; " ^
    "$content | Set-Content -Path '%TARGET_FILE%' -Encoding UTF8 -NoNewline"

if %errorlevel% neq 0 (
    echo [错误] 注入失败！正在恢复备份...
    copy /y "%BACKUP_FILE%" "%TARGET_FILE%" >nul
    pause
    exit /b 1
)

echo.
echo ========================================
echo  注入完成！
echo ========================================
echo.
echo 请启动 PokéClicker Desktop 查看翻译效果。
echo.
echo 提示：
echo   - 首次加载需要网络连接下载翻译数据
echo   - 按 F12 打开开发者工具可查看加载日志
echo   - 游戏更新后需重新运行此脚本
echo.
echo 如需回滚，请运行：
echo   copy "%BACKUP_FILE%" "%TARGET_FILE%"
echo.
pause
