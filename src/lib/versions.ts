import localVersions from "../../config/versions.json";

export function buildVersionsConfig(
  baseConfig: any,
  mode: "latest" | "custom",
  ref: string
) {
  const next = JSON.parse(JSON.stringify(baseConfig ?? localVersions));
  const normalizedRef = mode === "latest" ? "master" : ref.trim();
  if (!next.comfyui) next.comfyui = {};
  if (!next.docker) next.docker = {};
  next.comfyui.version = mode === "latest" ? "latest" : normalizedRef;
  next.comfyui.target_branch = normalizedRef;
  next.comfyui.selected_ref = normalizedRef;
  next.comfyui.selection_mode = mode;
  next.docker.webui_ref = normalizedRef;
  return next;
}
