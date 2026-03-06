@echo off
echo 正在清理 Electron 和 Vite 进程...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
echo 清理完成！
pause
