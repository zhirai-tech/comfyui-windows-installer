use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::process::Command;
use super::SilentCommand;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpuInfo {
    pub has_nvidia: bool,
    pub gpu_name: String,
    pub vram_gb: u64,
    pub vram_total_mb: u64,
    pub vram_used_mb: u64,
    pub gpu_util_percent: u32,
    pub driver_version: String,
    pub cuda_version: String,
    pub recommendation: GpuRecommendation,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpuRecommendation {
    pub sd_15: bool,
    pub sdxl: bool,
    pub sdxl_highres: bool,
    pub video_light: bool,
    pub video_heavy: bool,
    pub flux: bool,
}

impl Default for GpuInfo {
    fn default() -> Self {
        Self {
            has_nvidia: false,
            gpu_name: "未检测到 NVIDIA GPU".to_string(),
            vram_gb: 0,
            vram_total_mb: 0,
            vram_used_mb: 0,
            gpu_util_percent: 0,
            driver_version: "-".to_string(),
            cuda_version: "-".to_string(),
            recommendation: GpuRecommendation {
                sd_15: false,
                sdxl: false,
                sdxl_highres: false,
                video_light: false,
                video_heavy: false,
                flux: false,
            },
        }
    }
}

fn recommend(vram_gb: u64) -> GpuRecommendation {
    GpuRecommendation {
        sd_15: vram_gb >= 4,
        sdxl: vram_gb >= 6,
        sdxl_highres: vram_gb >= 10,
        video_light: vram_gb >= 8,
        video_heavy: vram_gb >= 16,
        flux: vram_gb >= 12,
    }
}

pub(crate) fn parse_nvidia_smi(output: &str) -> Option<(String, u64, u64, String, String)> {
    // 输入为 --query-gpu 的 CSV 输出：name, memory.total, memory.used, driver_version
    let line = output.lines().map(str::trim).find(|l| !l.is_empty())?;
    let parts: Vec<&str> = line.split(',').map(str::trim).collect();
    if parts.len() < 4 {
        return None;
    }
    let name = parts[0].to_string();
    let total: u64 = parts[1].parse().unwrap_or(0);
    let used: u64 = parts[2].parse().unwrap_or(0);
    let driver = parts[3].to_string();
    if name.is_empty() || total == 0 {
        return None;
    }
    Some((name, total, used, driver, String::new()))
}

pub(crate) fn run_nvidia_smi() -> Result<String> {
    let out = Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total,memory.used,driver_version",
            "--format=csv,noheader,nounits",
        ])
        .silent()
        .output()?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

pub(crate) fn run_nvidia_gpu_util() -> Option<u32> {
    let out = Command::new("nvidia-smi")
        .args([
            "--query-gpu=utilization.gpu",
            "--format=csv,noheader,nounits",
        ])
        .silent()
        .output()
        .ok()?;
    let raw = String::from_utf8_lossy(&out.stdout).to_string();
    raw.lines()
        .map(str::trim)
        .find(|l| !l.is_empty())?
        .parse::<u32>()
        .ok()
}

fn run_nvidia_cuda_version() -> Option<String> {
    let out = Command::new("nvidia-smi").silent().output().ok()?;
    let raw = String::from_utf8_lossy(&out.stdout).to_string();
    for line in raw.lines() {
        if let Some(pos) = line.find("CUDA Version:") {
            let rest = &line[pos + "CUDA Version:".len()..];
            if let Some(v) = rest.split_whitespace().next() {
                return Some(v.to_string());
            }
        }
    }
    None
}

pub async fn detect_gpu() -> Result<GpuInfo, String> {
    let emit = |msg: &str| {
        crate::events::log("gpu", msg);
    };
    emit("正在检测显卡（nvidia-smi）...");

    let mut info = GpuInfo::default();

    match run_nvidia_smi() {
        Ok(raw) => {
            if let Some((name, mb, used, drv, _cuda)) = parse_nvidia_smi(&raw) {
                info.has_nvidia = true;
                info.gpu_name = name;
                info.vram_total_mb = mb;
                info.vram_used_mb = used;
                info.vram_gb = (mb as f64 / 1024.0).round() as u64;
                info.driver_version = if drv.is_empty() { "-".into() } else { drv };
                info.cuda_version = run_nvidia_cuda_version().unwrap_or_else(|| "-".into());
                info.gpu_util_percent = run_nvidia_gpu_util().unwrap_or(0);
                info.recommendation = recommend(info.vram_gb);
                emit(&format!(
                    "检测到 GPU: {} | {} GB VRAM | Driver {} | CUDA {} | 利用率 {}%",
                    info.gpu_name, info.vram_gb, info.driver_version, info.cuda_version, info.gpu_util_percent
                ));
                return Ok(info);
            }
        }
        Err(e) => {
            emit(&format!("nvidia-smi 不可用: {}", e));
        }
    }

    emit("未检测到 NVIDIA GPU，将使用 CPU 模式（速度较慢）");
    info.recommendation = recommend(0);
    Ok(info)
}
