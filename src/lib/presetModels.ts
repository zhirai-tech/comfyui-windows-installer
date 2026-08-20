import type { LocalizedText } from "./i18n";

export interface PresetModel {
  id: string;
  name: LocalizedText;
  fileName: string;
  category: string; // models 子目录名，如 checkpoints / vae / upscale_models
  url: string;
  sizeHint: LocalizedText;
  description: LocalizedText;
}

export const PRESET_MODELS: PresetModel[] = [
  {
    id: "sd15",
    name: { zh: "SD 1.5 基础模型", en: "SD 1.5 Base Model" },
    fileName: "v1-5-pruned-emaonly.ckpt",
    category: "checkpoints",
    url: "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.ckpt",
    sizeHint: { zh: "约 4.0 GB", en: "~4.0 GB" },
    description: {
      zh: "文生图 / 图生图 / 老照片修复的基础 Checkpoint",
      en: "Base Checkpoint for text-to-image / image-to-image / old photo restoration",
    },
  },
  {
    id: "sdxl",
    name: { zh: "SDXL Base", en: "SDXL Base" },
    fileName: "sd_xl_base_1.0.safetensors",
    category: "checkpoints",
    url: "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors",
    sizeHint: { zh: "约 6.9 GB", en: "~6.9 GB" },
    description: {
      zh: "SDXL 高清文生图 Checkpoint（1024×1024）",
      en: "SDXL HD text-to-image Checkpoint (1024×1024)",
    },
  },
  {
    id: "vae15",
    name: { zh: "SD 1.5 VAE", en: "SD 1.5 VAE" },
    fileName: "vae-ft-mse-840000-ema-pruned.safetensors",
    category: "vae",
    url: "https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.safetensors",
    sizeHint: { zh: "约 335 MB", en: "~335 MB" },
    description: {
      zh: "SD 1.5 配套 VAE，改善色彩与细节",
      en: "VAE for SD 1.5, improves color and detail",
    },
  },
  {
    id: "vaesdxl",
    name: { zh: "SDXL VAE", en: "SDXL VAE" },
    fileName: "sdxl_vae.safetensors",
    category: "vae",
    url: "https://huggingface.co/stabilityai/sdxl-vae/resolve/main/sdxl_vae.safetensors",
    sizeHint: { zh: "约 335 MB", en: "~335 MB" },
    description: {
      zh: "SDXL 配套 VAE",
      en: "VAE for SDXL",
    },
  },
  {
    id: "esrgan",
    name: { zh: "RealESRGAN x4", en: "RealESRGAN x4" },
    fileName: "RealESRGAN_x4plus.pth",
    category: "upscale_models",
    url: "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
    sizeHint: { zh: "约 64 MB", en: "~64 MB" },
    description: {
      zh: "超分辨率 / 老照片修复的放大模型",
      en: "Upscale model for super resolution / old photo restoration",
    },
  },
  {
    id: "wan21_t2v_1.3b",
    name: { zh: "Wan 2.1 文生视频 1.3B", en: "Wan 2.1 Text-to-Video 1.3B" },
    fileName: "wan2.1_t2v_1.3B_fp16.safetensors",
    category: "diffusion_models",
    url: "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_t2v_1.3B_fp16.safetensors",
    sizeHint: { zh: "约 2.8 GB", en: "~2.8 GB" },
    description: {
      zh: "Wan 2.1 文生视频扩散模型（1.3B fp16，8GB 显存可跑）",
      en: "Wan 2.1 text-to-video diffusion model (1.3B fp16, runs on 8GB VRAM)",
    },
  },
  {
    id: "wan21_umt5",
    name: { zh: "Wan 2.1 文本编码器", en: "Wan 2.1 Text Encoder" },
    fileName: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    category: "text_encoders",
    url: "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    sizeHint: { zh: "约 6 GB", en: "~6 GB" },
    description: {
      zh: "Wan 2.1 文生视频共用的 UMT5 文本编码器（fp8，原生支持中文）",
      en: "UMT5 text encoder (fp8) shared by Wan 2.1 text-to-video, natively supports Chinese",
    },
  },
  {
    id: "wan21_vae",
    name: { zh: "Wan 2.1 VAE", en: "Wan 2.1 VAE" },
    fileName: "wan_2.1_vae.safetensors",
    category: "vae",
    url: "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors",
    sizeHint: { zh: "约 300 MB", en: "~300 MB" },
    description: {
      zh: "Wan 2.1 文生视频共用的 VAE",
      en: "VAE shared by Wan 2.1 text-to-video",
    },
  },
];
