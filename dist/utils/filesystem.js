import fs from "node:fs/promises";
import path from "node:path";
import { CONFIG, getWorkspaceDir, getIntentsDir, getActiveIntentPointerPath } from "../config.js";
/**
 * Generates an intent ID following the YYMMDD-<label> format.
 */
export function generateIntentId(label) {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const sanitizedLabel = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
    return `${yy}${mm}${dd}-${sanitizedLabel || "intent"}`;
}
/**
 * Gets the directory for a specific intent.
 */
export function getIntentDirPath(intentId, workspaceDir = getWorkspaceDir()) {
    return path.join(getIntentsDir(workspaceDir), intentId);
}
/**
 * Formats IntentState into canonical markdown for aidlc-state.md.
 */
export function formatAidlcStateMarkdown(state) {
    const currentStage = state.stages[state.currentStageIndex];
    const stageName = currentStage ? `${currentStage.number} ${currentStage.name}` : "Completed";
    const lines = [
        `# AI-DLC State: ${state.intentId}`,
        "",
        `**Label**: ${state.label}  `,
        `**Scope / Profile**: \`${state.profile}\`  `,
        `**Project Type**: \`${state.projectType}\`  `,
        `**Depth**: \`${state.depth}\`  `,
        `**Test Strategy**: \`${state.testStrategy}\`  `,
        `**Status**: \`${state.status}\`  `,
        `**Current Stage**: ${stageName}  `,
        `**Updated At**: ${state.updatedAt}  `,
        "",
        "## Description",
        state.description,
        "",
        "## Stage Roadmap & Gates",
        "| Stage | Name | Phase | Status | Artifact | Approved |",
        "|---|---|---|---|---|---|",
    ];
    for (const s of state.stages) {
        const statusIcon = s.status === "approved"
            ? "✅ Approved"
            : s.status === "in_progress"
                ? "⏳ In Progress"
                : s.status === "rubric_satisfied"
                    ? "🔍 Rubric Met (Gate Pending)"
                    : s.status === "skipped"
                        ? "⏭️ Skipped"
                        : "⏸️ Pending";
        const artifactLink = s.artifactPath ? `[${path.basename(s.artifactPath)}](${s.artifactPath})` : "-";
        const approved = s.approvedAt ? s.approvedAt.slice(0, 10) : "-";
        lines.push(`| ${s.number} | ${s.name} | ${s.phase} | ${statusIcon} | ${artifactLink} | ${approved} |`);
    }
    lines.push("");
    lines.push("---");
    lines.push("*Managed by AI-DLC Socratic MCP Server. 'You decide, AI executes.'*");
    return lines.join("\n");
}
/**
 * Scaffolds an intent folder and initial state files.
 */
export async function scaffoldIntent(state, workspaceDir = getWorkspaceDir()) {
    const intentDir = getIntentDirPath(state.intentId, workspaceDir);
    await fs.mkdir(intentDir, { recursive: true });
    // 1. Write project-description.json
    const descPath = path.join(intentDir, CONFIG.DESCRIPTION_FILE);
    await fs.writeFile(descPath, JSON.stringify({
        intentId: state.intentId,
        label: state.label,
        scope: state.profile,
        projectType: state.projectType,
        depth: state.depth,
        testStrategy: state.testStrategy,
        description: state.description,
        createdAt: state.createdAt,
    }, null, 2), "utf-8");
    // 2. Write internal state json for quick parsing
    const stateJsonPath = path.join(intentDir, "intent-state.json");
    await fs.writeFile(stateJsonPath, JSON.stringify(state, null, 2), "utf-8");
    // 3. Write aidlc-state.md
    const stateMdPath = path.join(intentDir, CONFIG.STATE_FILE);
    await fs.writeFile(stateMdPath, formatAidlcStateMarkdown(state), "utf-8");
    // 4. Update active-intent pointer
    await setActiveIntent(state.intentId, workspaceDir);
    return intentDir;
}
/**
 * Saves updated IntentState back to disk.
 */
export async function persistIntentState(state, workspaceDir = getWorkspaceDir()) {
    state.updatedAt = new Date().toISOString();
    const intentDir = getIntentDirPath(state.intentId, workspaceDir);
    await fs.mkdir(intentDir, { recursive: true });
    const stateJsonPath = path.join(intentDir, "intent-state.json");
    await fs.writeFile(stateJsonPath, JSON.stringify(state, null, 2), "utf-8");
    const stateMdPath = path.join(intentDir, CONFIG.STATE_FILE);
    await fs.writeFile(stateMdPath, formatAidlcStateMarkdown(state), "utf-8");
}
/**
 * Loads IntentState for a specific intent ID.
 */
export async function loadIntentState(intentId, workspaceDir = getWorkspaceDir()) {
    const intentDir = getIntentDirPath(intentId, workspaceDir);
    const stateJsonPath = path.join(intentDir, "intent-state.json");
    try {
        const raw = await fs.readFile(stateJsonPath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/**
 * Sets the active intent ID.
 */
export async function setActiveIntent(intentId, workspaceDir = getWorkspaceDir()) {
    const pointerPath = getActiveIntentPointerPath(workspaceDir);
    await fs.mkdir(path.dirname(pointerPath), { recursive: true });
    await fs.writeFile(pointerPath, JSON.stringify({ activeIntentId: intentId, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
}
/**
 * Gets the active intent ID.
 */
export async function getActiveIntentId(workspaceDir = getWorkspaceDir()) {
    const pointerPath = getActiveIntentPointerPath(workspaceDir);
    try {
        const raw = await fs.readFile(pointerPath, "utf-8");
        const data = JSON.parse(raw);
        return data.activeIntentId || null;
    }
    catch {
        return null;
    }
}
/**
 * Loads the currently active IntentState.
 */
export async function loadActiveIntentState(workspaceDir = getWorkspaceDir()) {
    const activeId = await getActiveIntentId(workspaceDir);
    if (!activeId)
        return null;
    return loadIntentState(activeId, workspaceDir);
}
/**
 * Lists all existing intents in the workspace.
 */
export async function listAllIntents(workspaceDir = getWorkspaceDir()) {
    const intentsDir = getIntentsDir(workspaceDir);
    try {
        const entries = await fs.readdir(intentsDir, { withFileTypes: true });
        return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    }
    catch {
        return [];
    }
}
/**
 * Saves a stage artifact file inside the intent directory.
 */
export async function saveStageArtifact(intentId, phase, artifactName, content, workspaceDir = getWorkspaceDir()) {
    const intentDir = getIntentDirPath(intentId, workspaceDir);
    const phaseDir = path.join(intentDir, phase);
    await fs.mkdir(phaseDir, { recursive: true });
    const artifactPath = path.join(phaseDir, artifactName);
    await fs.writeFile(artifactPath, content, "utf-8");
    // Relative path from workspace
    return path.relative(workspaceDir, artifactPath);
}
//# sourceMappingURL=filesystem.js.map