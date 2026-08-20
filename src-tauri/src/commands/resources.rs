use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

use super::SilentCommand;

/// ComfyUI 本体目录（install_dir/ComfyUI）
fn comfyui_dir(install_dir: &str) -> PathBuf {
    PathBuf::from(install_dir).join("ComfyUI")
}

const MODEL_EXTS: &[&str] = &["safetensors", "ckpt", "pt", "pth", "bin", "gguf", "pkl"];

/// models 子目录 → 中文分类标签
const MODEL_CATEGORIES: &[(&str, &str)] = &[
    ("checkpoints", "Checkpoint"),
    ("loras", "LoRA"),
    ("vae", "VAE"),
    ("controlnet", "ControlNet"),
    ("upscale_models", "Upscale"),
    ("latent_upscale_models", "Latent Upscale"),
    ("clip", "CLIP"),
    ("clip_vision", "CLIP Vision"),
    ("embeddings", "Embedding"),
    ("unet", "UNet"),
    ("diffusion_models", "Diffusion"),
    ("text_encoders", "Text Encoder"),
    ("hypernetworks", "Hypernetwork"),
];

#[derive(Debug, Serialize, Clone)]
pub struct ModelFile {
    pub name: String,
    pub category: String,
    pub dir: String,
    pub size_bytes: u64,
    pub path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CategoryCount {
    pub category: String,
    pub count: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct ModelsScanResult {
    pub models: Vec<ModelFile>,
    pub total: usize,
    pub categories: Vec<CategoryCount>,
}

#[derive(Debug, Serialize, Clone)]
pub struct NodeInfo {
    pub name: String,
    pub path: String,
    pub disabled: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct WorkflowFile {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct BlueprintModel {
    pub name: String,
    pub url: String,
    pub directory: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct BlueprintInfo {
    pub file: String,
    pub title: String,
    pub category: String,
    pub node_types: Vec<String>,
    pub models: Vec<BlueprintModel>,
}

#[derive(Debug, Serialize, Clone)]
pub struct WorkflowAnalysis {
    pub file_name: String,
    pub node_types: Vec<String>,
    pub missing_nodes: Vec<String>,
    pub api_node_types: Vec<String>,
    pub model_refs: Vec<String>,
    pub missing_models: Vec<String>,
    pub input_refs: Vec<String>,
    pub missing_inputs: Vec<String>,
}

fn is_model_file(p: &std::path::Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| MODEL_EXTS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

#[tauri::command]
pub async fn scan_models(install_dir: String) -> ModelsScanResult {
    let models_root = comfyui_dir(&install_dir).join("models");
    let mut models: Vec<ModelFile> = Vec::new();
    let mut categories: Vec<CategoryCount> = Vec::new();

    if models_root.is_dir() {
        for (dir_name, label) in MODEL_CATEGORIES {
            let sub = models_root.join(dir_name);
            if !sub.is_dir() {
                continue;
            }
            let mut count = 0usize;
            if let Ok(entries) = std::fs::read_dir(&sub) {
                for e in entries.flatten() {
                    let p = e.path();
                    if p.is_file() && is_model_file(&p) {
                        let size = std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
                        models.push(ModelFile {
                            name: p.file_name().unwrap_or_default().to_string_lossy().to_string(),
                            category: label.to_string(),
                            dir: dir_name.to_string(),
                            size_bytes: size,
                            path: p.to_string_lossy().to_string(),
                        });
                        count += 1;
                    }
                }
            }
            if count > 0 {
                categories.push(CategoryCount { category: label.to_string(), count });
            }
        }

        // models 根目录下的散落文件归为「其他」
        if let Ok(entries) = std::fs::read_dir(&models_root) {
            for e in entries.flatten() {
                let p = e.path();
                if p.is_file() && is_model_file(&p) {
                    let size = std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
                    models.push(ModelFile {
                        name: p.file_name().unwrap_or_default().to_string_lossy().to_string(),
                        category: "其他".to_string(),
                        dir: String::new(),
                        size_bytes: size,
                        path: p.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    models.sort_by(|a, b| a.category.cmp(&b.category).then_with(|| a.name.cmp(&b.name)));
    let total = models.len();
    ModelsScanResult { models, total, categories }
}

#[tauri::command]
pub async fn scan_nodes(install_dir: String) -> Vec<NodeInfo> {
    let nodes_root = comfyui_dir(&install_dir).join("custom_nodes");
    let mut nodes: Vec<NodeInfo> = Vec::new();

    if nodes_root.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&nodes_root) {
            for e in entries.flatten() {
                let p = e.path();
                if !p.is_dir() {
                    continue;
                }
                let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                let disabled = name.ends_with(".disabled") || name.starts_with("__");
                nodes.push(NodeInfo {
                    name,
                    path: p.to_string_lossy().to_string(),
                    disabled,
                });
            }
        }
    }

    nodes.sort_by(|a, b| a.name.cmp(&b.name));
    nodes
}

#[tauri::command]
pub async fn scan_workflows(install_dir: String) -> Vec<WorkflowFile> {
    let workflows_dir = comfyui_dir(&install_dir).join("user").join("default").join("workflows");
    let mut workflows: Vec<WorkflowFile> = Vec::new();

    if workflows_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&workflows_dir) {
            for e in entries.flatten() {
                let p = e.path();
                if p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json") {
                    let size = std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
                    workflows.push(WorkflowFile {
                        name: p.file_stem().unwrap_or_default().to_string_lossy().to_string(),
                        path: p.to_string_lossy().to_string(),
                        size_bytes: size,
                    });
                }
            }
        }
    }

    workflows.sort_by(|a, b| a.name.cmp(&b.name));
    workflows
}

#[tauri::command]
pub fn install_preset_workflow(
    install_dir: String,
    file_name: String,
    content: String,
) -> Result<String, String> {
    let name = file_name.trim();
    if name.is_empty()
        || name
            .chars()
            .any(|c| matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err("非法工作流文件名".to_string());
    }
    let dir = comfyui_dir(&install_dir)
        .join("user")
        .join("default")
        .join("workflows");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {}", e))?;
    let path = dir.join(format!("{}.json", name));
    std::fs::write(&path, content).map_err(|e| format!("写入失败: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_workflow(install_dir: String, file_name: String) -> Result<(), String> {
    let name = file_name.trim();
    if name.is_empty()
        || name
            .chars()
            .any(|c| matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err("非法工作流文件名".to_string());
    }
    let path = comfyui_dir(&install_dir)
        .join("user")
        .join("default")
        .join("workflows")
        .join(format!("{}.json", name));
    if !path.exists() {
        return Err("工作流文件不存在".to_string());
    }
    std::fs::remove_file(&path).map_err(|e| format!("删除失败: {}", e))
}

#[tauri::command]
pub fn install_custom_node(
    install_dir: String,
    node_name: String,
    git_url: String,
) -> Result<String, String> {
    let name = node_name.trim();
    if name.is_empty()
        || name
            .chars()
            .any(|c| matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err("非法节点名".to_string());
    }
    let custom_nodes = comfyui_dir(&install_dir).join("custom_nodes");
    let target = custom_nodes.join(name);

    if target.exists() {
        return Ok(format!("节点「{}」已存在，跳过安装", name));
    }

    std::fs::create_dir_all(&custom_nodes).map_err(|e| format!("创建目录失败: {}", e))?;

    let clone = Command::new("git")
        .args(["clone", "--depth", "1", git_url.as_str(), name])
        .current_dir(&custom_nodes)
        .silent()
        .output()
        .map_err(|e| format!("git 执行失败: {}", e))?;
    if !clone.status.success() {
        let err = String::from_utf8_lossy(&clone.stderr).trim().to_string();
        return Err(format!("git clone 失败: {}", err));
    }

    let req = target.join("requirements.txt");
    if req.exists() {
        let venv_python = PathBuf::from(&install_dir)
            .join("venv")
            .join("Scripts")
            .join("python.exe");
        if venv_python.exists() {
            let req_str = req.to_string_lossy().to_string();
            let pip = Command::new(&venv_python)
                .args(["-m", "pip", "install", "-r", req_str.as_str(), "--no-input"])
                .current_dir(&target)
                .silent()
                .output()
                .map_err(|e| format!("pip 执行失败: {}", e))?;
            if !pip.status.success() {
                return Ok(format!("节点「{}」已安装，但依赖安装失败（可稍后重试）", name));
            }
        }
    }

    Ok(format!("节点「{}」安装完成", name))
}

#[tauri::command]
pub fn delete_node(install_dir: String, node_name: String) -> Result<(), String> {
    let name = node_name.trim();
    if name.is_empty()
        || name
            .chars()
            .any(|c| matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err("非法节点名".to_string());
    }
    let path = comfyui_dir(&install_dir).join("custom_nodes").join(name);
    if !path.exists() {
        return Err("节点目录不存在".to_string());
    }
    std::fs::remove_dir_all(&path).map_err(|e| format!("删除失败: {}", e))
}

/// 本地大模型 + 中文翻译自定义节点源码（本地离线）。
/// 翻译：Helsinki-NLP/opus-mt-zh-en（轻量）；大模型：Qwen（LOCAL_LLM_MODEL 可换）。
/// 提供节点：
/// - CLIPTextEncodeZh / CLIPTextEncodeSDXLZh：中文提示词编码（opus-mt 翻译）
/// - PromptZhToEn：中文→英文提示词（本地大模型翻译）
/// - LLMTextGen：通用本地大模型文本生成
/// - ScriptWriter：短剧剧本生成
/// - CharacterSheet：角色设定生成
/// - SaveText：把文本保存到 output 目录
const TRANSLATE_NODE_PY: &str = r#"# ComfyUI 本地大模型 + 中文翻译节点（本地离线）
# 翻译模型：opus-mt-zh-en（轻量）；大模型：Qwen（可用环境变量 LOCAL_LLM_MODEL 更换）。
import logging
import os

logger = logging.getLogger("ComfyUI-LocalLLM")

_TOKENIZER = None
_MODEL = None


def _has_chinese(text):
    return any('\u4e00' <= ch <= '\u9fff' for ch in text)


def _load_model():
    global _TOKENIZER, _MODEL
    if _MODEL is not None:
        return _TOKENIZER, _MODEL
    import os
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    name = os.environ.get("ZH_TRANSLATE_MODEL", "Helsinki-NLP/opus-mt-zh-en")
    logger.info("[中文翻译] 正在加载本地翻译模型 %s ...", name)
    _TOKENIZER = AutoTokenizer.from_pretrained(name)
    _MODEL = AutoModelForSeq2SeqLM.from_pretrained(name)
    logger.info("[中文翻译] 模型加载完成")
    return _TOKENIZER, _MODEL


def translate_zh_to_en(text):
    if not text:
        return ""
    text = str(text).strip()
    if not text:
        return ""
    # 没有中文字符时原样返回，避免英文提示词被误翻译
    if not _has_chinese(text):
        return text
    tok, model = _load_model()
    inputs = tok(text, return_tensors="pt", max_length=512, truncation=True)
    outputs = model.generate(**inputs, max_new_tokens=512)
    return tok.decode(outputs[0], skip_special_tokens=True).strip()


# ---------- 本地大模型（默认 Qwen，可用环境变量 LOCAL_LLM_MODEL 更换） ----------
_LLM_TOKENIZER = None
_LLM_MODEL = None

DEFAULT_LLM_MODEL = os.environ.get("LOCAL_LLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")


def _load_llm():
    global _LLM_TOKENIZER, _LLM_MODEL
    if _LLM_MODEL is not None:
        return _LLM_TOKENIZER, _LLM_MODEL
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM
    name = DEFAULT_LLM_MODEL
    logger.info("[大模型] 正在加载 %s ...", name)
    _LLM_TOKENIZER = AutoTokenizer.from_pretrained(name)
    try:
        _LLM_MODEL = AutoModelForCausalLM.from_pretrained(
            name, torch_dtype=torch.float16, device_map="auto", low_cpu_mem_usage=True
        )
    except Exception as e:
        logger.warning("[大模型] 自动分配失败，退回 CPU 加载: %s", e)
        _LLM_MODEL = AutoModelForCausalLM.from_pretrained(name)
    logger.info("[大模型] 加载完成")
    return _LLM_TOKENIZER, _LLM_MODEL


def llm_generate(system, user, max_new_tokens=1024, temperature=0.7):
    import torch
    tok, model = _load_llm()
    system = system or ""
    user = user or ""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    try:
        prompt = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    except Exception:
        prompt = f"<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n"
    inputs = tok(prompt, return_tensors="pt")
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=int(max_new_tokens),
            do_sample=True,
            temperature=float(temperature),
            top_p=0.9,
            repetition_penalty=1.05,
        )
    generated = output[0][inputs["input_ids"].shape[1]:]
    return tok.decode(generated, skip_special_tokens=True).strip()


class CLIPTextEncodeZh:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "dynamicPrompts": True, "default": "一座美丽的山间湖泊，夕阳，杰作，最佳质量"}),
                "clip": ("CLIP",),
            }
        }

    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "encode"
    CATEGORY = "model/conditioning/中文"
    DESCRIPTION = "中文提示词编码（SD1.5）：先自动把中文翻译成英文，再送入 CLIP 编码。"

    def encode(self, text, clip):
        en = translate_zh_to_en(text)
        tokens = clip.tokenize(en)
        return (clip.encode_from_tokens_scheduled(tokens),)


class CLIPTextEncodeSDXLZh:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "width": ("INT", {"default": 1024, "min": 0, "max": 16384}),
                "height": ("INT", {"default": 1024, "min": 0, "max": 16384}),
                "crop_w": ("INT", {"default": 0, "min": 0, "max": 16384}),
                "crop_h": ("INT", {"default": 0, "min": 0, "max": 16384}),
                "target_width": ("INT", {"default": 1024, "min": 0, "max": 16384}),
                "target_height": ("INT", {"default": 1024, "min": 0, "max": 16384}),
                "text_g": ("STRING", {"multiline": True, "dynamicPrompts": True, "default": "一座美丽的山间湖泊，夕阳，杰作，最佳质量，高度细节"}),
                "text_l": ("STRING", {"multiline": True, "dynamicPrompts": True, "default": "锐利对焦，鲜艳色彩，电影级光线"}),
                "clip": ("CLIP",),
            }
        }

    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "encode"
    CATEGORY = "model/conditioning/中文"
    DESCRIPTION = "中文提示词编码（SDXL）：先自动把中文翻译成英文，再送入 CLIP 编码。"

    def encode(self, width, height, crop_w, crop_h, target_width, target_height, text_g, text_l, clip):
        en_g = translate_zh_to_en(text_g)
        en_l = translate_zh_to_en(text_l)
        tokens = clip.tokenize(en_g)
        tokens["l"] = clip.tokenize(en_l)["l"]
        if len(tokens["l"]) != len(tokens["g"]):
            empty = clip.tokenize("")
            while len(tokens["l"]) < len(tokens["g"]):
                tokens["l"] += empty["l"]
            while len(tokens["l"]) > len(tokens["g"]):
                tokens["g"] += empty["g"]
        return (clip.encode_from_tokens_scheduled(tokens, add_dict={
            "width": width, "height": height, "crop_w": crop_w, "crop_h": crop_h,
            "target_width": target_width, "target_height": target_height}),)


def _text_result(text):
    return {"ui": {"text": [text]}, "result": (text,)}


class PromptZhToEn:
    """中文提示词 -> 英文提示词（本地大模型翻译，输出英文 STRING，可直接接 CLIPTextEncode）。"""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "dynamicPrompts": True, "default": "一位年轻女孩站在海边，夕阳，电影感"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "translate"
    CATEGORY = "大模型/翻译"
    DESCRIPTION = "中文提示词 → 英文提示词（本地大模型），输出英文字符串，可直接连接 CLIPTextEncode。"

    def translate(self, text):
        text = (text or "").strip()
        if not text:
            return ("",)
        if not _has_chinese(text):
            return (text,)
        system = (
            "你是专业的中文到英文 Stable Diffusion 提示词翻译。"
            "把用户的中文描述翻译成地道的英文提示词，保留并补充风格词（masterpiece, best quality, highly detailed 等），"
            "用英文逗号分隔，只输出英文，不要任何解释。"
        )
        return (llm_generate(system, text, 512, 0.3),)


class LLMTextGen:
    """通用本地大模型文本生成：system + prompt -> text。"""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "system": ("STRING", {"multiline": True, "default": "你是一个专业的中文内容创作助手。"}),
                "prompt": ("STRING", {"multiline": True, "default": ""}),
                "max_new_tokens": ("INT", {"default": 1024, "min": 32, "max": 8192}),
                "temperature": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0, "step": 0.05}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "generate"
    CATEGORY = "大模型/文本"
    OUTPUT_NODE = True
    DESCRIPTION = "通用本地大模型文本生成：输入 system/prompt，输出文本。"

    def generate(self, system, prompt, max_new_tokens, temperature):
        return _text_result(llm_generate(system, prompt, int(max_new_tokens), float(temperature)))


class ScriptWriter:
    """短剧剧本生成：中文主题 -> 完整剧本（分章节/分集/时长）。"""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "theme": ("STRING", {"multiline": True, "default": "一个穷小子逆袭成为商界大佬"}),
                "episodes": ("INT", {"default": 5, "min": 1, "max": 60}),
                "minutes_per_episode": ("INT", {"default": 1, "min": 1, "max": 5}),
                "max_new_tokens": ("INT", {"default": 4096, "min": 512, "max": 8192}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "write"
    CATEGORY = "大模型/短剧"
    OUTPUT_NODE = True
    DESCRIPTION = "短剧剧本生成：输入中文主题，输出完整剧本（剧名/角色表/分章/分集脚本）。"

    def write(self, theme, episodes, minutes_per_episode, max_new_tokens):
        system = (
            "你是一名资深 AI 短剧编剧。根据用户给的中文主题，创作一部完整的短剧剧本，用 Markdown 输出：\n"
            "1. 剧名；2. 一句话简介；3. 主要角色表（主角 + 配角，姓名/年龄/身份/性格）；\n"
            "4. 分章大纲（每章标题 + 一句话内容）；5. 分集脚本（每集：集数、时长、场景、镜头、对白、画面描述）。\n"
            "要求剧情完整、有起承转合，适合短视频短剧。"
        )
        prompt = f"主题：{theme}\n要求：分成 {episodes} 集，每集约 {minutes_per_episode} 分钟。"
        return _text_result(llm_generate(system, prompt, int(max_new_tokens), 0.8))


class CharacterSheet:
    """角色设定生成：剧本 + 角色清单 -> 角色卡（年龄/装扮/三视图/换装）。"""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "script": ("STRING", {"multiline": True, "default": ""}),
                "roles": ("STRING", {"multiline": True, "default": "主角：林晓（男，28 岁，穷小子逆袭）\n配角1：苏晴（女，25 岁，女主角）\n配角2：陈锋（男，35 岁，反派）"}),
                "max_new_tokens": ("INT", {"default": 4096, "min": 512, "max": 8192}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "write"
    CATEGORY = "大模型/短剧"
    OUTPUT_NODE = True
    DESCRIPTION = "角色设定生成：输入剧本与角色清单，输出每个角色的角色卡（年龄/装扮/三视图/换装）。"

    def write(self, script, roles, max_new_tokens):
        system = (
            "你是一名 AI 短剧角色设定师。根据剧本与角色清单，为每个角色生成角色卡，用 Markdown 输出，每个角色必须包含：\n"
            "1. 姓名；2. 年龄（若故事跨多年，列出不同年龄段：如 8 岁 / 15 岁 / 28 岁，并说明各阶段外貌差异）；\n"
            "3. 外貌与装扮（每个年龄段的具体描述）；4. 性格与身份；\n"
            "5. 三视图/定板英文提示词（可直接用于 Stable Diffusion 生成一致形象）；\n"
            "6. 换装需求（每套服装描述）。要求描述具体、可执行。"
        )
        prompt = f"剧本或剧情概要：\n{script}\n\n角色清单：\n{roles}"
        return _text_result(llm_generate(system, prompt, int(max_new_tokens), 0.8))


class SaveText:
    """把文本保存到 ComfyUI output 目录并显示。"""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "forceInput": True}),
                "filename_prefix": ("STRING", {"default": "短剧"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "save"
    CATEGORY = "大模型/输出"
    OUTPUT_NODE = True
    DESCRIPTION = "把文本保存到 ComfyUI output 目录（.txt）并显示。"

    def save(self, text, filename_prefix):
        import time
        try:
            from folder_paths import get_output_directory
            out_dir = get_output_directory()
        except Exception:
            out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "output")
        stamp = time.strftime("%Y%m%d-%H%M%S")
        safe = (filename_prefix or "短剧").strip() or "短剧"
        path = os.path.join(out_dir, f"{safe}_{stamp}.txt")
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(text or "")
        except Exception as e:
            logger.warning("[大模型] 保存文本失败: %s", e)
        return _text_result(text)


class TTSGenerate:
    """文本配音：把中文台词合成语音，保存到 ComfyUI output 目录（mp3）。"""

    DEFAULT_VOICE = os.environ.get("LOCAL_TTS_VOICE", "zh-CN-XiaoxiaoNeural")

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": "大家好，欢迎观看我的短剧。"}),
                "voice": ("STRING", {"default": s.DEFAULT_VOICE}),
                "rate": ("STRING", {"default": "+0%"}),
                "filename_prefix": ("STRING", {"default": "配音"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("audio",)
    FUNCTION = "synthesize"
    CATEGORY = "大模型/音频"
    OUTPUT_NODE = True
    DESCRIPTION = "文本配音：把中文台词合成语音（默认 Edge 在线语音，可通过 voice 输入或环境变量 LOCAL_TTS_VOICE 换声音），保存为 mp3。"

    def synthesize(self, text, voice, rate, filename_prefix):
        import asyncio
        import time
        text = (text or "").strip()
        if not text:
            return ("",)
        try:
            import edge_tts
        except Exception as e:
            logger.warning("[配音] 缺少 edge-tts，请安装：pip install edge-tts (%s)", e)
            return ("",)
        try:
            from folder_paths import get_output_directory
            out_dir = get_output_directory()
        except Exception:
            out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "output")
        stamp = time.strftime("%Y%m%d-%H%M%S")
        safe = (filename_prefix or "配音").strip() or "配音"
        path = os.path.join(out_dir, f"{safe}_{stamp}.mp3")
        try:
            comm = edge_tts.Communicate(text, voice or self.DEFAULT_VOICE, rate=rate or "+0%")
            asyncio.run(comm.save(path))
        except Exception as e:
            logger.warning("[配音] 合成失败: %s", e)
            return ("",)
        return _text_result(path)


def _find_ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    return "ffmpeg"


class VideoCompose:
    """视频合成：把静音视频（mp4）与配音（mp3）合成为带声音的成品视频。"""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "video_path": ("STRING", {"default": "", "multiline": False}),
                "audio_path": ("STRING", {"default": "", "multiline": False}),
                "filename_prefix": ("STRING", {"default": "成片"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("video",)
    FUNCTION = "compose"
    CATEGORY = "大模型/输出"
    OUTPUT_NODE = True
    DESCRIPTION = "视频合成：把静音视频（mp4）与配音（mp3）合成为带声音的成品视频（字幕保持独立 srt）。"

    def compose(self, video_path, audio_path, filename_prefix):
        import subprocess
        import time
        video_path = (video_path or "").strip()
        audio_path = (audio_path or "").strip()
        if not video_path or not os.path.exists(video_path):
            logger.warning("[合成] 视频文件不存在: %s", video_path)
            return ("",)
        try:
            from folder_paths import get_output_directory
            out_dir = get_output_directory()
        except Exception:
            out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "output")
        stamp = time.strftime("%Y%m%d-%H%M%S")
        safe = (filename_prefix or "成片").strip() or "成片"
        out_path = os.path.join(out_dir, f"{safe}_{stamp}.mp4")
        ffmpeg = _find_ffmpeg()
        cmd = [ffmpeg, "-y", "-i", video_path]
        if audio_path and os.path.exists(audio_path):
            cmd += ["-i", audio_path, "-c:v", "copy", "-c:a", "aac", "-shortest"]
        else:
            cmd += ["-c:v", "copy", "-an"]
        cmd.append(out_path)
        try:
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode != 0:
                logger.warning("[合成] ffmpeg 失败: %s", (r.stderr or "")[-500:])
                return ("",)
        except Exception as e:
            logger.warning("[合成] 执行失败: %s", e)
            return ("",)
        return _text_result(out_path)


NODE_CLASS_MAPPINGS = {
    "CLIPTextEncodeZh": CLIPTextEncodeZh,
    "CLIPTextEncodeSDXLZh": CLIPTextEncodeSDXLZh,
    "PromptZhToEn": PromptZhToEn,
    "LLMTextGen": LLMTextGen,
    "ScriptWriter": ScriptWriter,
    "CharacterSheet": CharacterSheet,
    "SaveText": SaveText,
    "TTSGenerate": TTSGenerate,
    "VideoCompose": VideoCompose,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CLIPTextEncodeZh": "中文提示词编码 (SD1.5)",
    "CLIPTextEncodeSDXLZh": "中文提示词编码 (SDXL)",
    "PromptZhToEn": "中文提示词 → 英文 (大模型)",
    "LLMTextGen": "本地大模型文本生成",
    "ScriptWriter": "短剧剧本生成",
    "CharacterSheet": "角色设定生成",
    "SaveText": "保存文本",
    "TTSGenerate": "文本配音 (TTS)",
    "VideoCompose": "视频合成 (配音/字幕)",
}
"#;

const TRANSLATE_NODE_DIR: &str = "comfyui-translate-zh";

/// 部署中文翻译节点到 custom_nodes 并安装 Python 依赖（transformers / sentencepiece）。
/// 幂等：节点已存在时也重写源码并尝试补齐依赖。
#[tauri::command]
pub fn install_translate_node(install_dir: String) -> Result<String, String> {
    let custom_nodes = comfyui_dir(&install_dir).join("custom_nodes");
    let node_dir = custom_nodes.join(TRANSLATE_NODE_DIR);
    std::fs::create_dir_all(&node_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    std::fs::write(node_dir.join("__init__.py"), TRANSLATE_NODE_PY)
        .map_err(|e| format!("写入节点失败: {}", e))?;
    std::fs::write(
        node_dir.join("requirements.txt"),
        "transformers>=4.30\nsentencepiece\naccelerate\nedge-tts\nimageio-ffmpeg\n",
    )
    .map_err(|e| format!("写入依赖失败: {}", e))?;

    let venv_python = PathBuf::from(&install_dir)
        .join("venv")
        .join("Scripts")
        .join("python.exe");
    if venv_python.exists() {
        let req_str = node_dir.join("requirements.txt").to_string_lossy().to_string();
        let pip = Command::new(&venv_python)
            .args(["-m", "pip", "install", "-r", req_str.as_str(), "--no-input"])
            .current_dir(&node_dir)
            .silent()
            .output()
            .map_err(|e| format!("pip 执行失败: {}", e))?;
        if !pip.status.success() {
            return Ok("中文翻译节点已写入，但依赖安装失败（可稍后重试）".to_string());
        }
    }

    Ok("中文翻译节点已安装".to_string())
}

fn is_uuid(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36
        && b[8] == b'-'
        && b[13] == b'-'
        && b[18] == b'-'
        && b[23] == b'-'
        && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

/// 模型文件名归一化：去掉路径与扩展名，转小写，用于「工作流引用名」与「磁盘文件名」比对。
fn norm_model_name(name: &str) -> String {
    let n = name.trim().to_lowercase().replace('\\', "/");
    let base = n.rsplit('/').next().unwrap_or(&n);
    match base.rfind('.') {
        Some(i) => base[..i].to_string(),
        None => base.to_string(),
    }
}

/// 收集安装目录下所有模型文件名（归一化后），供工作流依赖检测复用。
fn collect_model_names(install_dir: &str) -> std::collections::HashSet<String> {
    let models_root = comfyui_dir(install_dir).join("models");
    let mut names = std::collections::HashSet::new();
    if !models_root.is_dir() {
        return names;
    }
    let mut dirs: Vec<std::path::PathBuf> = MODEL_CATEGORIES
        .iter()
        .map(|(d, _)| models_root.join(d))
        .collect();
    dirs.push(models_root.clone());
    for d in dirs {
        if !d.is_dir() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(&d) {
            for e in entries.flatten() {
                let p = e.path();
                if p.is_file() && is_model_file(&p) {
                    let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                    names.insert(norm_model_name(&name));
                }
            }
        }
    }
    names
}

/// 判断字符串是否为模型文件名引用（以常见模型扩展名结尾）。
fn is_model_ref(s: &str) -> bool {
    let lower = s.trim().to_lowercase();
    MODEL_EXTS.iter().any(|ext| lower.ends_with(&format!(".{}", ext)))
}

fn collect_json_strings(v: &serde_json::Value, out: &mut Vec<String>) {
    match v {
        serde_json::Value::String(s) => out.push(s.clone()),
        serde_json::Value::Array(arr) => {
            for x in arr {
                collect_json_strings(x, out);
            }
        }
        serde_json::Value::Object(map) => {
            for (_, val) in map {
                collect_json_strings(val, out);
            }
        }
        _ => {}
    }
}

fn valid_file_name(name: &str) -> bool {
    let n = name.trim();
    !n.is_empty()
        && !n
            .chars()
            .any(|c| matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
}

/// 疑似「第三方 API」节点类型关键词（小写子串匹配）。
/// 仅用于诊断时提示“可能需要配置 API”，不做具体 Provider 判定（Provider Adapter 留待后续阶段）。
const API_NODE_HINTS: &[&str] = &[
    "openai", "claude", "anthropic", "gemini", "google", "minimax", "kling",
    "runway", "pixverse", "pika", "luma", "midjourney", "dall-e", "dalle",
    "replicate", "stability", "huggingface", "together",
];

/// 递归收集目录下的所有 .py 文件（跳过 __pycache__、隐藏目录、.disabled 与 __ 前缀目录）。
fn collect_py_files(dir: &std::path::Path, out: &mut Vec<std::path::PathBuf>) {
    if !dir.is_dir() {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for e in entries.flatten() {
        let p = e.path();
        let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
        if p.is_dir() {
            if name == "__pycache__"
                || name.starts_with('.')
                || name.ends_with(".disabled")
                || name.starts_with("__")
            {
                continue;
            }
            collect_py_files(&p, out);
        } else if p.extension().and_then(|x| x.to_str()) == Some("py") {
            out.push(p);
        }
    }
}

/// 从单个 Python 文件里提取 `NODE_CLASS_MAPPINGS = { ... }` 中的节点类型 key（字符串字面量）。
/// 这是“尽力而为”的离线检测：对于动态构造映射的少数节点包可能漏提取，
/// 未来可改为读取运行中 ComfyUI 的 `/object_info` 接口获得权威结果。
fn extract_node_class_mappings(content: &str) -> Vec<String> {
    static BLOCK_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    static KEY_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let block_re = BLOCK_RE.get_or_init(|| {
        regex::Regex::new(r"(?s)NODE_CLASS_MAPPINGS\s*=\s*\{(.*?)\}").unwrap()
    });
    let key_re = KEY_RE.get_or_init(|| regex::Regex::new(r#"["']([^"']+)["']"#).unwrap());

    let mut out = Vec::new();
    for caps in block_re.captures_iter(content) {
        if let Some(body) = caps.get(1) {
            for kc in key_re.captures_iter(body.as_str()) {
                if let Some(k) = kc.get(1) {
                    let s = k.as_str().trim().to_string();
                    if !s.is_empty() {
                        out.push(s);
                    }
                }
            }
        }
    }
    out
}

/// 收集 ComfyUI 已知的全部节点类型（核心 nodes.py/comfy_extras + 已安装 custom_nodes）。
fn collect_registered_node_types(install_dir: &str) -> std::collections::HashSet<String> {
    let root = comfyui_dir(install_dir);
    let mut files: Vec<std::path::PathBuf> = Vec::new();
    files.push(root.join("nodes.py"));
    collect_py_files(&root.join("comfy_extras"), &mut files);
    collect_py_files(&root.join("custom_nodes"), &mut files);

    let mut types = std::collections::HashSet::new();
    for f in files {
        if let Ok(content) = std::fs::read_to_string(&f) {
            for t in extract_node_class_mappings(&content) {
                types.insert(t);
            }
        }
    }
    types
}

/// 扫描 ComfyUI 官方模板（blueprints/*.json）。
/// 不复制、不维护，仅读取官方模板里的标题/分类/节点类型/模型依赖（含下载地址）。
#[tauri::command]
pub async fn scan_blueprints(install_dir: String) -> Vec<BlueprintInfo> {
    let dir = comfyui_dir(&install_dir).join("blueprints");
    let mut result: Vec<BlueprintInfo> = Vec::new();
    if !dir.is_dir() {
        return result;
    }
    let mut entries: Vec<std::path::PathBuf> = std::fs::read_dir(&dir)
        .map(|rd| rd.flatten().map(|e| e.path()).collect())
        .unwrap_or_default();
    entries.sort();

    for p in entries {
        if !p.is_file() || p.extension().and_then(|x| x.to_str()) != Some("json") {
            continue;
        }
        let file = p.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let Ok(content) = std::fs::read_to_string(&p) else {
            continue;
        };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };
        let nodes = json
            .get("nodes")
            .and_then(|n| n.as_array())
            .cloned()
            .unwrap_or_default();

        let mut title = file.clone();
        let mut category = String::new();
        let mut node_types: Vec<String> = Vec::new();
        let mut models: Vec<BlueprintModel> = Vec::new();
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

        for node in &nodes {
            let ty = node.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string();
            // 官方蓝图入口节点用 UUID 作为 type；真实节点类型名才是依赖判定的对象。
            if is_uuid(&ty) {
                if title == file {
                    if let Some(t) = node.get("title").and_then(|t| t.as_str()) {
                        if !t.trim().is_empty() {
                            title = t.to_string();
                        }
                    }
                }
                continue;
            }
            if ty.is_empty() {
                continue;
            }
            if seen.insert(ty.clone()) {
                node_types.push(ty);
            }
            if let Some(props) = node.get("properties") {
                if let Some(ms) = props.get("models").and_then(|m| m.as_array()) {
                    for m in ms {
                        let name = m.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                        if name.is_empty() {
                            continue;
                        }
                        let url = m.get("url").and_then(|u| u.as_str()).unwrap_or("").to_string();
                        let directory = m.get("directory").and_then(|d| d.as_str()).unwrap_or("").to_string();
                        models.push(BlueprintModel { name, url, directory });
                    }
                }
            }
        }
        if let Some(c) = json.get("category").and_then(|c| c.as_str()) {
            category = c.to_string();
        }
        node_types.sort();
        result.push(BlueprintInfo {
            file,
            title,
            category,
            node_types,
            models,
        });
    }
    result
}

/// 分析指定工作流（user/default/workflows/*.json）的依赖：
/// 提取节点类型、模型引用、输入引用，并检测缺失的模型与输入文件。
/// 节点缺失由前端结合「核心节点白名单 + 自定义节点注册表」进一步判定。
#[tauri::command]
pub async fn analyze_workflow(
    install_dir: String,
    file_name: String,
) -> Result<WorkflowAnalysis, String> {
    let name = file_name.trim();
    if !valid_file_name(name) {
        return Err("非法工作流文件名".to_string());
    }
    let path = comfyui_dir(&install_dir)
        .join("user")
        .join("default")
        .join("workflows")
        .join(format!("{}.json", name));
    if !path.exists() {
        return Err("工作流文件不存在".to_string());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| format!("读取失败: {}", e))?;
    let json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("JSON 解析失败: {}", e))?;

    let mut node_types: Vec<String> = Vec::new();
    let mut model_refs: Vec<String> = Vec::new();
    let mut input_refs: Vec<String> = Vec::new();
    let mut seen_nodes: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut seen_models: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut seen_inputs: std::collections::HashSet<String> = std::collections::HashSet::new();

    if let Some(nodes) = json.get("nodes").and_then(|n| n.as_array()) {
        for node in nodes {
            let ty = node.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string();
            if !ty.is_empty() && seen_nodes.insert(ty.clone()) {
                node_types.push(ty.clone());
            }
            let mut strings: Vec<String> = Vec::new();
            if let Some(wv) = node.get("widgets_values") {
                collect_json_strings(wv, &mut strings);
            }
            for s in strings {
                if is_model_ref(&s) && seen_models.insert(s.clone()) {
                    model_refs.push(s);
                }
            }
            if ty.starts_with("LoadImage") {
                if let Some(wv) = node.get("widgets_values").and_then(|w| w.as_array()) {
                    if let Some(first) = wv.first().and_then(|v| v.as_str()) {
                        let f = first.trim().to_string();
                        if !f.is_empty() && f != "input" && seen_inputs.insert(f.clone()) {
                            input_refs.push(f);
                        }
                    }
                }
            }
        }
    }

    node_types.sort();
    model_refs.sort();
    input_refs.sort();

    let installed_models = collect_model_names(&install_dir);
    let missing_models: Vec<String> = model_refs
        .iter()
        .filter(|m| !installed_models.contains(&norm_model_name(m)))
        .cloned()
        .collect();

    let registered_nodes = collect_registered_node_types(&install_dir);
    let missing_nodes: Vec<String> = node_types
        .iter()
        .filter(|t| !registered_nodes.contains(t.as_str()))
        .cloned()
        .collect();

    let api_node_types: Vec<String> = node_types
        .iter()
        .filter(|t| {
            let lower = t.to_lowercase();
            API_NODE_HINTS.iter().any(|h| lower.contains(h))
        })
        .cloned()
        .collect();

    let input_dir = comfyui_dir(&install_dir).join("input");
    let missing_inputs: Vec<String> = input_refs
        .iter()
        .filter(|f| !input_dir.join(f).exists())
        .cloned()
        .collect();

    Ok(WorkflowAnalysis {
        file_name: name.to_string(),
        node_types,
        missing_nodes,
        api_node_types,
        model_refs,
        missing_models,
        input_refs,
        missing_inputs,
    })
}
