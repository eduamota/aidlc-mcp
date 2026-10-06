import fs from "node:fs/promises";
import path from "node:path";
import { getWorkspaceDir, getSpaceDir, getMemoryDir, getMemoryPhasesDir, CONFIG } from "../config.js";
import { Phase } from "../types.js";
import { getMemoryDefault } from "../memory/registry.js";

/**
 * Ensures memory directories exist and seeds default memory files if missing.
 */
export async function ensureMemoryDirs(
  workspaceDir: string = getWorkspaceDir(),
  space: string = CONFIG.DEFAULT_SPACE
): Promise<string> {
  const memDir = getMemoryDir(workspaceDir, space);
  const phasesDir = getMemoryPhasesDir(workspaceDir, space);

  await fs.mkdir(memDir, { recursive: true });
  await fs.mkdir(phasesDir, { recursive: true });

  const seedFiles = [
    { targetPath: path.join(memDir, "org.md"), key: "org" },
    { targetPath: path.join(memDir, "team.md"), key: "team" },
    { targetPath: path.join(memDir, "project.md"), key: "project" },
    { targetPath: path.join(phasesDir, "ideation.md"), key: "phases/ideation" },
    { targetPath: path.join(phasesDir, "inception.md"), key: "phases/inception" },
    { targetPath: path.join(phasesDir, "construction.md"), key: "phases/construction" },
    { targetPath: path.join(phasesDir, "operation.md"), key: "phases/operation" },
  ];

  for (const { targetPath, key } of seedFiles) {
    try {
      await fs.access(targetPath);
    } catch {
      const defaultContent = getMemoryDefault(key);
      if (defaultContent) {
        await fs.writeFile(targetPath, defaultContent, "utf-8");
      }
    }
  }

  return memDir;
}

/**
 * Reads the raw content of a specific memory layer or phase guardrail file.
 */
export async function readMemoryLayer(
  layer: string,
  workspaceDir: string = getWorkspaceDir(),
  space: string = CONFIG.DEFAULT_SPACE
): Promise<string> {
  const ws = workspaceDir || getWorkspaceDir();
  await ensureMemoryDirs(ws, space);
  const memDir = getMemoryDir(ws, space);

  let targetFile = path.join(memDir, `${layer}.md`);
  if (layer.startsWith("phases/")) {
    targetFile = path.join(memDir, `${layer}.md`);
  }

  try {
    return await fs.readFile(targetFile, "utf-8");
  } catch {
    return getMemoryDefault(layer) || "";
  }
}

/**
 * Resolves active layered memory (org -> team -> project -> phase guardrails).
 */
export async function resolveActiveMemory(params?: {
  phase?: Phase;
  workspaceDir?: string;
  space?: string;
}): Promise<{
  layers: {
    org: string;
    team: string;
    project: string;
    phaseRules?: string;
  };
  combinedText: string;
}> {
  const ws = params?.workspaceDir || getWorkspaceDir();
  const space = params?.space || CONFIG.DEFAULT_SPACE;
  await ensureMemoryDirs(ws, space);

  const memDir = getMemoryDir(ws, space);
  const phasesDir = getMemoryPhasesDir(ws, space);

  async function readFileOrDefault(filePath: string, defaultKey: string): Promise<string> {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return getMemoryDefault(defaultKey) || "";
    }
  }

  const org = await readFileOrDefault(path.join(memDir, "org.md"), "org");
  const team = await readFileOrDefault(path.join(memDir, "team.md"), "team");
  const project = await readFileOrDefault(path.join(memDir, "project.md"), "project");

  let phaseRules: string | undefined;
  if (params?.phase) {
    phaseRules = await readFileOrDefault(path.join(phasesDir, `${params.phase}.md`), `phases/${params.phase}`);
  }

  const sections: string[] = [
    "# AI-DLC Resolved Active Memory",
    "",
    "## 1. Organization-Level Defaults (org.md)",
    org.trim(),
    "",
    "## 2. Team-Level Affirmed Rules (team.md)",
    team.trim(),
    "",
    "## 3. Project-Level Local Rules (project.md)",
    project.trim(),
  ];

  if (phaseRules) {
    sections.push("", `## 4. Phase Guardrails (${params?.phase}.md)`, phaseRules.trim());
  }

  return {
    layers: {
      org,
      team,
      project,
      phaseRules,
    },
    combinedText: sections.join("\n"),
  };
}

/**
 * Extracts a specific H2 section rule from an exact memory layer (for [memory:M<n>] source verification).
 */
export async function getMemoryRule(
  layer: "org" | "team" | "project" | string,
  heading: string,
  workspaceDir: string = getWorkspaceDir(),
  space: string = CONFIG.DEFAULT_SPACE
): Promise<string | null> {
  const ws = workspaceDir || getWorkspaceDir();
  await ensureMemoryDirs(ws, space);
  const memDir = getMemoryDir(ws, space);

  let targetFile = path.join(memDir, `${layer}.md`);
  if (layer.startsWith("phases/")) {
    targetFile = path.join(memDir, `${layer}.md`);
  }

  let text = "";
  try {
    text = await fs.readFile(targetFile, "utf-8");
  } catch {
    text = getMemoryDefault(layer) || "";
  }

  if (!text) return null;

  const lines = text.split(/\r?\n/);
  let found = false;
  const sectionLines: string[] = [];
  const headingLower = heading.trim().toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (found) {
        break; // Reached next H2 section
      }
      if (
        match[1].trim().toLowerCase() === headingLower ||
        match[1].trim().toLowerCase().startsWith(headingLower)
      ) {
        found = true;
        continue;
      }
    } else if (found) {
      sectionLines.push(line);
    }
  }

  return found ? sectionLines.join("\n").trim() : null;
}

/**
 * Updates or sets an affirmed rule under an H2 heading in team.md or project.md.
 */
export async function updateMemoryRule(
  layer: "team" | "project",
  heading: string,
  content: string,
  workspaceDir: string = getWorkspaceDir(),
  space: string = CONFIG.DEFAULT_SPACE
): Promise<{ success: boolean; filePath: string }> {
  const ws = workspaceDir || getWorkspaceDir();
  await ensureMemoryDirs(ws, space);
  const memDir = getMemoryDir(ws, space);
  const targetFile = path.join(memDir, `${layer}.md`);

  let text = "";
  try {
    text = await fs.readFile(targetFile, "utf-8");
  } catch {
    text = getMemoryDefault(layer) || `# ${layer.toUpperCase()} Rules\n\n`;
  }

  const lines = text.split(/\r?\n/);
  let foundStart = -1;
  let foundEnd = -1;
  const headingLower = heading.trim().toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (foundStart !== -1) {
        foundEnd = i;
        break;
      }
      if (
        match[1].trim().toLowerCase() === headingLower ||
        match[1].trim().toLowerCase().startsWith(headingLower)
      ) {
        foundStart = i;
      }
    }
  }

  const newSection = `## ${heading}\n\n${content.trim()}\n`;
  let updatedText = "";

  if (foundStart !== -1) {
    const before = lines.slice(0, foundStart).join("\n");
    const after = foundEnd !== -1 ? lines.slice(foundEnd).join("\n") : "";
    updatedText = `${before.trimEnd()}\n\n${newSection}\n${after.trimStart()}`.trim() + "\n";
  } else {
    updatedText = `${text.trimEnd()}\n\n${newSection}`.trim() + "\n";
  }

  await fs.writeFile(targetFile, updatedText, "utf-8");
  return { success: true, filePath: path.relative(ws, targetFile) };
}

/**
 * Records a human correction or learned practice to learnings.md.
 */
export async function recordLearning(params: {
  stageId?: string;
  learning: string;
  author?: string;
  workspaceDir?: string;
  space?: string;
}): Promise<{ success: boolean; filePath: string }> {
  const ws = params.workspaceDir || getWorkspaceDir();
  const space = params.space || CONFIG.DEFAULT_SPACE;
  await ensureMemoryDirs(ws, space);
  const memDir = getMemoryDir(ws, space);
  const learningsFile = path.join(memDir, "learnings.md");

  const timestamp = new Date().toISOString();
  const stageNotice = params.stageId ? ` (Stage: \`${params.stageId}\`)` : "";
  const entry = `- [${timestamp}]${stageNotice} ${params.learning.trim()}\n`;

  try {
    await fs.appendFile(learningsFile, entry, "utf-8");
  } catch {
    const initial = `# AI-DLC Learnings & Corrections Diary\n\n${entry}`;
    await fs.writeFile(learningsFile, initial, "utf-8");
  }

  return { success: true, filePath: path.relative(ws, learningsFile) };
}
