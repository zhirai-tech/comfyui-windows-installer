# ComfyUI Installer

> One-click install · Smart hardware detection · Online update · Service hosting

[中文](README.zh.md)

**ComfyUI Installer** is a desktop client of ComfyUI for everyday users. It compresses the complex workflow of "installing Python, setting up a virtual environment, choosing the right PyTorch for your GPU, installing dependencies, and writing launch scripts" into a one-click installation that only takes a few mouse clicks. A fully localized UI plus real-time logs means even beginners can understand every step.

![ComfyUI Installer · Console overview](screenshots/console.png)

---

## Table of Contents

- [What problem does it solve](#what-problem-does-it-solve)
- [Core features](#core-features)
- [Two deployment modes](#two-deployment-modes)
- [System requirements](#system-requirements)
- [GPU capability tiers](#gpu-capability-tiers)
- [Quick start](#quick-start)
- [Workflow market](#workflow-market)
- [Model & node management](#model--node-management)
- [FAQ](#faq)
- [Download & install](#download--install)
- [Changelog](#changelog)
- [Roadmap](#roadmap)
- [Contact](#contact)

---

## What problem does it solve

ComfyUI is powerful, but the installation barrier scares off many newcomers:

- You must install **Python** (and get the version right);
- Create a **virtual environment**;
- Pick the correct **PyTorch / CUDA** version for your GPU;
- Install dozens or hundreds of **dependency packages**;
- Write your own **launch scripts** and configure ports and startup arguments.

One mistake anywhere, and you're greeted with a wall of English error messages.

**ComfyUI Installer automates all of these steps.** You only need to:

1. Open the app;
2. Choose "Local deployment" or "Docker";
3. Click "Start install".

The app takes care of the rest and automatically starts the service and opens the UI when done.

![Install progress page](screenshots/install.png)

---

## Core features

### 1. One-click fully automatic installation
- Automatically prepares the Python environment (downloads portable Python 3.10 when no system Python is present);
- Automatically downloads ComfyUI (latest by default, or a specific branch / tag);
- Automatically creates a virtual environment, installs dependencies, and configures the launcher;
- Automatically starts the service and opens the Web UI when installation completes.

### 2. Smart hardware detection
- Automatically detects GPU model, VRAM, driver version, CPU, memory, and disk;
- Built-in GPU database that normalizes model names (e.g. `NVIDIA GeForce RTX 2060` → `RTX 2060`);
- VRAM is read from nvidia-smi first for accurate results.

![Hardware detection result](screenshots/env-detect.png)

### 3. GPU capability assessment
Automatically classifies your GPU into tiers based on VRAM and tells you what it can run:

| Tier | VRAM | What it can do |
|------|------|----------------|
| Entry | < 6 GB | SD 1.5 / SDXL low-resolution images; small models, low-res video |
| Mid-range | 6~11 GB | SD / SDXL Turbo 2K images; AnimateDiff / SVD 720P short video |
| High-end | 12~19 GB | SDXL + FLUX.1 images; CogVideoX 5B / Wan2.1 7B short video; full-body digital human |
| Flagship | ≥ 20 GB | 8K upscaling; Wan2.1 / HunyuanVideo 1080P long video; multi-character livestream-grade digital human; 4K 3D |

### 4. Workflow market
- Built-in "Free / Featured / Latest / Trending" categories;
- One-click workflow installation with automatic resolution of missing models;
- Workflows that can't run on your hardware show a clear message like "This workflow requires XX or above; your current XX (XGB) cannot run it", so beginners understand exactly what to upgrade.

![Workflow market](screenshots/workflow-market.png)

### 5. Model / node management
- One-click download of common models into the correct model directory;
- One-click install / remove of custom nodes;
- Support for installing Chinese translation nodes.

![Model & node management](screenshots/models-nodes.png)

### 6. Automatic Chinese prompt translation
- Type Chinese directly into the prompt box; a local translation model converts it to English;
- Runs fully locally with no internet required (first run downloads ~300MB translation model).

### 7. Environment check & one-click repair
- One-click check of ComfyUI, Python, PyTorch, CUDA, GPU, ports, and model / workflow directories;
- Fix issues with one click instead of reinstalling from scratch.

![Environment check & repair](screenshots/repair.png)

### 8. UX improvements
- System tray background running with single-instance support;
- Chinese / English UI switching, light / dark themes;
- In-app online updates (semi-automatic: download and install manually when a new version is detected).

---

## Two deployment modes

| | Local (host) | Docker (container) |
|---|---|---|
| Best for | Everyday users | Technical users |
| Pros | Most stable GPU passthrough, lowest VRAM usage, fastest startup | Easy version rollback, portable environment, multiple isolated setups |
| Cons | Reinstall needed when migrating to another machine | Requires Docker Desktop (~2GB); +1~2GB extra VRAM |
| Prerequisites | None (portable Python auto-installed) | Enable WSL2 + install Docker Desktop |

> For first-time use we recommend "Local deployment" — the lowest barrier and the least VRAM.

---

## System requirements

| Item | Requirement |
|------|-------------|
| OS | Windows 10 / 11 64-bit |
| GPU | NVIDIA GPU recommended (CPU mode supported, but slower) |
| Disk | ≥ 30GB free (≥ 50GB recommended; models are large) |
| Memory | Local ≥ 8GB; Docker ≥ 16GB |
| Network | Internet required during install (download accelerator configurable) |

---

## Quick start

1. Download the latest Windows installer from [Releases](https://github.com/tangxiaoqi966-lab/comfyui-installer/releases);
2. Double-click to install and open "ComfyUI Installer";
3. Choose "Local deployment" or "Docker", and pick an install directory (a non-system drive is recommended);
4. Click "Start install" and wait for it to finish (the first PyTorch download takes ~5–30 minutes, which is normal);
5. It starts automatically when done; click "Open UI" to use it in your browser.

![Deployment selection page](screenshots/welcome.png)

---

## FAQ

**Q: What should I do if the installation gets stuck?**
Check the real-time logs — they tell you which step failed and why. Common causes are slow network, insufficient disk space, or an interrupted PyTorch download. Retry, or configure a download accelerator in "Settings".

**Q: How do I know if my GPU can run a workflow?**
The workflow market judges this automatically. Runnable ones show "Install"; non-runnable ones clearly tell you the minimum GPU tier and VRAM required.

**Q: Do prompts have to be in English?**
No. Just type Chinese directly into the prompt box — a local model translates it to English automatically.

**Q: How do I update the software?**
The client has built-in update detection. When a new version is found on the home page, click "Download update" and install manually. It never silently installs in the background.

**Q: Where is my data stored?**
By default it installs to a non-system drive (e.g. `D:\ComfyUI`). Models, nodes, and workflows all live in that directory. Uninstalling deletes the whole directory (with a confirmation prompt).

---

## Download & install

- Latest: https://github.com/tangxiaoqi966-lab/comfyui-installer/releases/latest
- All versions: https://github.com/tangxiaoqi966-lab/comfyui-installer/releases

> This repository is only for publishing compiled installers and does **not contain source code**.

---

## Changelog

- **v0.1.0** (2026-08): First release. Supports local / Docker deployment, smart hardware detection, workflow market, model / node management, Chinese prompt translation, environment check & one-click repair, and in-app online updates.

---

## Roadmap

- Real statistics (seed values for workflow likes / downloads plus real accumulation);
- Server-pushed personalized capability assessment and recommendations;
- Custom pip / PyTorch download accelerators;
- Custom ComfyUI repository URL;
- Manual PyTorch / CUDA version selection by VRAM;
- Auto-download a specified model list after installation.

---

## Contact

- WeChat / QQ / email (see "Contact" inside the app)
- For feedback and issues, please submit at [Issues](https://github.com/tangxiaoqi966-lab/comfyui-installer/issues)

---

© 2026 Zhirui Tech. All rights reserved.
