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
export function getWorkspaceDir() {
    return process.env.AIDLC_WORKSPACE || process.cwd();
}
export function getSpaceDir(workspaceDir = getWorkspaceDir(), space = CONFIG.DEFAULT_SPACE) {
    return path.join(workspaceDir, CONFIG.BASE_DIR_REL, space);
}
export function getIntentsDir(workspaceDir = getWorkspaceDir(), space = CONFIG.DEFAULT_SPACE) {
    return path.join(getSpaceDir(workspaceDir, space), "intents");
}
export function getActiveIntentPointerPath(workspaceDir = getWorkspaceDir()) {
    return path.join(getSpaceDir(workspaceDir), CONFIG.ACTIVE_INTENT_FILE);
}
//# sourceMappingURL=config.js.map