export interface InstallHooksOptions {
    target: "claude-code" | "cursor" | "git" | "all";
    workspaceDir?: string;
}
export interface InstallHooksResult {
    installed: string[];
    skipped: string[];
    instructions: string[];
}
/**
 * Installs client harness lifecycle hooks for Claude Code, Cursor, or Git.
 */
export declare function installHooks(options: InstallHooksOptions): Promise<InstallHooksResult>;
