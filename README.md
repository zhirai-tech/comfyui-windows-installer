> **简体中文 | English**
>
> ComfyUI 安装助手：Windows 环境检测、Python/PyTorch 安装、模型与节点配置、修复与版本管理界面。
>
> **ComfyUI Installer Helper**: a Windows UI for environment detection, Python/PyTorch setup, model/node configuration, repair and version management.

---

# ComfyUI 安装助手

面向 Windows 的 ComfyUI 安装与配置界面：环境检测、Python/PyTorch 安装、模型与节点配置、修复和版本管理。

## 项目状态

`IN_DEVELOPMENT` — 仓库包含前端源码与 PowerShell 安装脚本，Release 提供可执行分发。

## 技术栈

- React 18 + TypeScript + Vite
- Tailwind CSS
- PowerShell 安装/修复脚本
- Tauri/安装器分发（以 Release 实际产物为准）

## 本地开发

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

## 目录

- `src/`：React UI。
- `scripts/`：环境安装、Python/PyTorch、修复脚本。
- `config/versions.json`：版本配置。
- `public/`：图标与静态资源。

## 限制

- 仅面向 Windows。
- 实际安装行为依赖目标机器环境和外部下载源。
- 本项目不包含 ComfyUI 本体。
