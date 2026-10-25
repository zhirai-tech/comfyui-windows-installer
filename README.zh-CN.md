[English](README.md) | [简体中文](README.zh-CN.md) | [个人网站](https://zhirai.cloud)

---

# ComfyUI Windows 安装器

## Screenshots / 截图

![Installer welcome](screenshots/welcome.png)
![Environment detection](screenshots/env-detect.png)
![Models and nodes](screenshots/models-nodes.png)

*ComfyUI installer welcome, environment detection and model/node configuration screens. / ComfyUI 安装助手欢迎页、环境检测和模型/节点配置页。*


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

---

## 作者与联系方式

**ZHIRAI · 智睿科技 · 独立开发者**

- 个人网站：[zhirai.cloud](https://zhirai.cloud)
- GitHub：[github.com/zhirai-tech](https://github.com/zhirai-tech)
- 技术支持：[xtang3125@gmail.com](mailto:xtang3125@gmail.com)
- 商务合作：[zhirai@zhirai.cloud](mailto:zhirai@zhirai.cloud)
- 品牌口号：*Build Ideas Into Reality / 把想法变成现实*
- 版权：© 2026 智睿科技 保留所有权利。
