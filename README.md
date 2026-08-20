# ComfyUI Installer

An open-source reference implementation for deploying and managing a local ComfyUI environment on Windows.

This project provides a desktop application (built with Tauri v2) that automates ComfyUI environment detection, installation, deployment, and runtime management. It is intended for learning, research, and reference purposes.

## Project Status

Stable / Reference Project

This project is currently released as an open-source reference implementation for ComfyUI deployment and desktop environment management.

It is not intended to replace the official ComfyUI Desktop application or ComfyUI Manager.

The current release represents the stable version of this project.

> 项目状态：稳定版本 / 开源参考项目。本项目目前作为 ComfyUI 本地部署及桌面环境管理的开源参考实现进行发布，不以替代 ComfyUI 官方 Desktop 或 ComfyUI Manager 为目标。当前 Release 为本项目现阶段的稳定版本。

## Features

- **Environment detection** — checks Python, PyTorch, CUDA, and disk prerequisites before installation.
- **Hardware detection** — reads GPU / VRAM and system information to recommend a suitable PyTorch configuration.
- **ComfyUI deployment** — downloads and sets up a local ComfyUI instance.
- **Runtime management** — start, stop, restart, and view logs for the local ComfyUI service.
- **Model management** — lists and downloads common models used by workflows.
- **Node / dependency repair** — analyzes workflow JSON and detects missing custom nodes and models.
- **Workflow analysis** — inspects ComfyUI blueprints and workflow files for missing nodes, models, and API requirements.
- **API configuration** — configures API provider settings without hardcoding keys into workflows.

## Architecture

- **Frontend**: React 18 + TypeScript + Zustand, built with Vite.
- **Backend**: Rust (Tauri v2) exposing native commands for environment, GPU, and ComfyUI management.
- **Config**: `config/versions.json` centralizes versions, mirrors, and download URLs.

```
src/
  components/   UI components
  hooks/        React hooks (bootstrap, install flow, service actions, updater)
  lib/          shared logic (i18n, manifest, telemetry, presets, versions)
  pages/        Welcome / Detect / Install / Manage / Settings / Complete
  store/        Zustand store and types
src-tauri/
  src/          Rust backend commands
  capabilities/ Tauri capabilities
  icons/        application icons
```

## Installation

Prerequisites:

- Windows 10/11
- Node.js 18+ and npm
- Rust toolchain (MSVC) for building the Tauri backend

```bash
npm install
```

## Usage

Run the desktop application in development mode:

```bash
npm run tauri dev
```

## Build

Build a production Windows installer:

```bash
npm run tauri build
```

The built artifacts are written to `src-tauri/target/release/`.

## Development

```bash
# Frontend only (Vite dev server)
npm run dev

# Type-check and build the frontend
npm run build
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Third-party components and dependencies remain subject to their respective licenses.
