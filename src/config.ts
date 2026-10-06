import path from "node:path";

export const CONFIG = {
  SERVER_NAME: "ai-dlc-socratic-mcp",
  SERVER_VERSION: "1.0.0",
  DEFAULT_SPACE: "default",
  BASE_DIR_REL: path.join("aidlc", "spaces"),
  STATE_FILE: "aidlc-state.md",
  DESCRIPTION_FILE: "project-description.json",
  ACTIVE_INTENT_FILE: "active-intent.json",
};

export function getWorkspaceDir(): string {
  return process.env.AIDLC_WORKSPACE || process.cwd();
}

export function getSpaceDir(workspaceDir: string = getWorkspaceDir(), space: string = CONFIG.DEFAULT_SPACE): string {
  return path.join(workspaceDir, CONFIG.BASE_DIR_REL, space);
}

export function getIntentsDir(workspaceDir: string = getWorkspaceDir(), space: string = CONFIG.DEFAULT_SPACE): string {
  return path.join(getSpaceDir(workspaceDir, space), "intents");
}

export function getKnowledgeDir(workspaceDir: string = getWorkspaceDir(), space: string = CONFIG.DEFAULT_SPACE): string {
  return path.join(getSpaceDir(workspaceDir, space), "knowledge");
}

export function getKnowledgeDocumentsDir(workspaceDir: string = getWorkspaceDir(), space: string = CONFIG.DEFAULT_SPACE): string {
  return path.join(getKnowledgeDir(workspaceDir, space), "documents");
}

export function getActiveIntentPointerPath(workspaceDir: string = getWorkspaceDir()): string {
  return path.join(getSpaceDir(workspaceDir), CONFIG.ACTIVE_INTENT_FILE);
}

export function getMemoryDir(workspaceDir: string = getWorkspaceDir(), space: string = CONFIG.DEFAULT_SPACE): string {
  return path.join(getSpaceDir(workspaceDir, space), "memory");
}

export function getMemoryPhasesDir(workspaceDir: string = getWorkspaceDir(), space: string = CONFIG.DEFAULT_SPACE): string {
  return path.join(getMemoryDir(workspaceDir, space), "phases");
}
