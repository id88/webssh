@echo off
setlocal

:: 获取当前脚本的绝对路径（无论从哪里启动）
set "ROOT=%~dp0"

:: 启动服务端窗口（进入 server 目录）
start "Server Window" cmd /k "cd /d "%ROOT%server" && npm run dev"

:: 启动客户端窗口（保持在根目录）
start "Client Window" cmd /k "cd /d "%ROOT%" && npm run dev"

endlocal