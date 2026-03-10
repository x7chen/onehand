# GitHub Actions 构建指南

## 概述

本项目使用 GitHub Actions 自动构建 Windows、macOS 和 Linux 三个平台的应用程序。

## 触发条件

### 1. 推送标签（推荐）
```bash
# 本地打标签并推送
git tag v0.1.0
git push origin v0.1.0
```

推送标签后，GitHub Actions 会自动触发构建，并在完成后创建 GitHub Release。

### 2. 手动触发
在 GitHub 仓库页面：
1. 进入 **Actions** 标签
2. 选择 **Build Release** 工作流
3. 点击 **Run workflow**
4. 选择分支（默认 main）
5. 点击 **Run workflow**

## 构建产物

### Windows
- `OneHand Setup *.exe` - 安装程序（x64）
- `win-unpacked/` - 便携版（仅 Artifact）

### macOS
- `*.dmg` - 磁盘镜像（x64 + ARM64 通用）

### Linux
- `*.AppImage` - AppImage 包（x64）
- `*.deb` - Debian 包（x64）

## 发布流程

1. **开发完成**：在本地完成功能开发和测试
2. **更新版本号**：修改 `package.json` 中的 `version` 字段
3. **提交并打标签**：
   ```bash
   git add .
   git commit -m "release: v0.1.0"
   git tag v0.1.0
   git push origin main
   git push origin v0.1.0
   ```
4. **等待构建完成**：GitHub Actions 会自动构建所有平台
5. **下载 Release**：构建完成后，在 GitHub Releases 页面下载各平台的安装包

## 本地构建

如果需要在本地构建特定平台：

```bash
# 构建当前平台
npm run electron:build

# 构建 Windows（仅在 Windows 上）
npm run electron:build:win

# 构建 macOS（仅在 macOS 上）
npm run electron:build:mac

# 构建 Linux（仅在 Linux 上）
npm run electron:build:linux
```

## 注意事项

1. **macOS 签名**：当前配置禁用了代码签名和公证，生产环境建议配置证书
2. **Linux 依赖**：构建 Linux 版本需要安装相关依赖库
3. **图标文件**：请确保 `build/` 目录包含以下图标文件：
   - `build/icon.ico` (Windows)
   - `build/icon.icns` (macOS)
   - `build/icon.png` (Linux, 512x512px)

## 故障排除

### 构建失败
查看 GitHub Actions 日志，常见错误：
- 依赖安装失败：尝试删除 `node_modules` 和 `package-lock.json` 后重新提交
- 构建超时：检查是否有大文件或网络问题

### 产物缺失
确保 `electron-builder.yml` 配置正确，检查输出路径是否为 `release/`
