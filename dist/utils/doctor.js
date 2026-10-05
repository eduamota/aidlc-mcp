import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getWorkspaceDir, getSpaceDir, CONFIG } from "../config.js";
import { listAllIntents, loadActiveIntentState } from "./filesystem.js";
const execAsync = promisify(exec);
export async function runDlcDoctor(workspaceDir = getWorkspaceDir()) {
    const checks = [];
    const spaceDir = getSpaceDir(workspaceDir);
    // 1. Check Node.js version
    try {
        const nodeVer = process.version;
        const major = parseInt(nodeVer.replace("v", "").split(".")[0], 10);
        if (major >= 18) {
            checks.push({
                name: "Node.js Runtime",
                status: "pass",
                message: `Node.js ${nodeVer} detected (>= v18 supported).`,
            });
        }
        else {
            checks.push({
                name: "Node.js Runtime",
                status: "warn",
                message: `Node.js ${nodeVer} is older than v18. Upgrade recommended.`,
            });
        }
    }
    catch (err) {
        checks.push({
            name: "Node.js Runtime",
            status: "fail",
            message: `Failed to inspect Node version: ${err.message}`,
        });
    }
    // 2. Check Git repository
    try {
        const gitDir = path.join(workspaceDir, ".git");
        await fs.access(gitDir);
        const { stdout } = await execAsync("git branch --show-current", { cwd: workspaceDir });
        checks.push({
            name: "Git Repository",
            status: "pass",
            message: `Git repository initialized on branch '${stdout.trim() || "HEAD"}'.`,
        });
    }
    catch {
        checks.push({
            name: "Git Repository",
            status: "warn",
            message: "No Git repository detected in workspace root. Version control recommended for intent tracking.",
        });
    }
    // 3. Check Workspace Writeability
    try {
        const testFile = path.join(workspaceDir, ".aidlc-write-test.tmp");
        await fs.writeFile(testFile, "test", "utf-8");
        await fs.unlink(testFile);
        checks.push({
            name: "Workspace Permissions",
            status: "pass",
            message: "Workspace root is fully writable.",
        });
    }
    catch (err) {
        checks.push({
            name: "Workspace Permissions",
            status: "fail",
            message: `Workspace root is not writable: ${err.message}`,
        });
    }
    // 4. Check AI-DLC Spaces & Scaffolding
    try {
        await fs.access(spaceDir);
        checks.push({
            name: "AI-DLC Space Scaffold",
            status: "pass",
            message: `Active space '${CONFIG.DEFAULT_SPACE}' directory present at \`${path.relative(workspaceDir, spaceDir)}\`.`,
        });
    }
    catch {
        checks.push({
            name: "AI-DLC Space Scaffold",
            status: "pass",
            message: `Clean project; active space directory will be bootstrapped automatically on first intent.`,
        });
    }
    // 5. Check Active Intent Health
    try {
        const intents = await listAllIntents(workspaceDir);
        const active = await loadActiveIntentState(workspaceDir);
        if (active) {
            checks.push({
                name: "Active Intent Health",
                status: "pass",
                message: `Active intent '${active.intentId}' (Stage: ${active.currentStageIndex + 1}/${active.stages.length}, Profile: ${active.profile}).`,
            });
        }
        else if (intents.length > 0) {
            checks.push({
                name: "Active Intent Health",
                status: "warn",
                message: `${intents.length} intent(s) exist, but no active intent is set. Use dlc_switch_intent to activate one.`,
            });
        }
        else {
            checks.push({
                name: "Active Intent Health",
                status: "pass",
                message: "No intents created yet. Ready for `dlc_init_intent`.",
            });
        }
    }
    catch (err) {
        checks.push({
            name: "Active Intent Health",
            status: "warn",
            message: `Error checking intent health: ${err.message}`,
        });
    }
    const hasFail = checks.some((c) => c.status === "fail");
    const hasWarn = checks.some((c) => c.status === "warn");
    return {
        overallStatus: hasFail ? "error" : hasWarn ? "warning" : "healthy",
        workspaceDir,
        activeSpace: CONFIG.DEFAULT_SPACE,
        checks,
    };
}
//# sourceMappingURL=doctor.js.map