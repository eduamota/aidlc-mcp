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

let activeWorkspaceDir: string | null = null;

export function setActiveWorkspaceDir(dir?: string): void {
  if (dir && typeof dir === "string" && dir.trim() !== "" && dir.trim() !== "/") {
    activeWorkspaceDir = path.resolve(dir.trim());
  }
}

export function getActiveWorkspaceDir(): string | null {
  return activeWorkspaceDir;
}

export function hasValidWorkspaceDir(): boolean {
  try {
    const ws = getWorkspaceDir();
    return Boolean(ws && ws !== "/");
  } catch {
    return false;
  }
}

export function assertValidWorkspaceDir(ws: string = getWorkspaceDir()): string {
  if (!ws || ws === "/" || ws.trim() === "") {
    throw new Error(
      "AI-DLC workspace cannot be filesystem root ('/'). The MCP server daemon was spawned without a project working directory. Please provide the 'workspace' argument in your tool call (e.g. workspace: '/path/to/project'), configure 'AIDLC_WORKSPACE' in your MCP server env config, or specify 'cwd' in mcp_config.json."
    );
  }
  return ws;
}

export function getWorkspaceDir(): string {
  // 1. Explicit AIDLC_WORKSPACE environment variable
  if (process.env.AIDLC_WORKSPACE && process.env.AIDLC_WORKSPACE.trim() !== "" && process.env.AIDLC_WORKSPACE.trim() !== "/") {
    return path.resolve(process.env.AIDLC_WORKSPACE.trim());
  }

  // 2. In-memory active workspace dynamically anchored by a tool call in current session
  if (activeWorkspaceDir && activeWorkspaceDir !== "/") {
    return activeWorkspaceDir;
  }

  // 3. Common IDE / Runner environment variables (e.g. npx sets INIT_CWD to caller directory)
  const candidateEnvs = [
    process.env.INIT_CWD,
    process.env.WORKSPACE_ROOT,
    process.env.PROJECT_DIR,
    process.env.WORKSPACE_FOLDER,
    process.env.PWD,
  ];

  for (const cand of candidateEnvs) {
    if (cand && typeof cand === "string" && cand.trim() !== "" && cand.trim() !== "/") {
      return path.resolve(cand.trim());
    }
  }

  // 4. Process working directory (fallback, safe for startup even if root "/")
  const cwd = process.cwd();
  return cwd ? path.resolve(cwd) : "/";
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
