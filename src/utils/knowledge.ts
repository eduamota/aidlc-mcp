import fs from "node:fs/promises";
import path from "node:path";
import { getKnowledgeDir, getWorkspaceDir, CONFIG } from "../config.js";
import { KnowledgeDocument } from "../types.js";

/**
 * Ensures knowledge directories exist for a space.
 */
export async function ensureKnowledgeDirs(workspaceDir: string = getWorkspaceDir(), space: string = CONFIG.DEFAULT_SPACE): Promise<string> {
  const kDir = getKnowledgeDir(workspaceDir, space);
  await fs.mkdir(path.join(kDir, "aidlc-shared"), { recursive: true });
  await fs.mkdir(path.join(kDir, "documents"), { recursive: true });
  return kDir;
}

/**
 * Adds or updates a knowledge document in the active space.
 */
export async function addKnowledgeDocument(params: {
  filename: string;
  content: string;
  category?: "shared" | "agent" | "documentkb";
  agent?: string;
  workspaceDir?: string;
  space?: string;
}): Promise<KnowledgeDocument> {
  const ws = params.workspaceDir || getWorkspaceDir();
  const space = params.space || CONFIG.DEFAULT_SPACE;
  const kDir = await ensureKnowledgeDirs(ws, space);

  let targetDir = path.join(kDir, "documents");
  if (params.category === "shared") {
    targetDir = path.join(kDir, "aidlc-shared");
  } else if (params.category === "agent" && params.agent) {
    targetDir = path.join(kDir, params.agent);
  }
  await fs.mkdir(targetDir, { recursive: true });

  const filePath = path.join(targetDir, params.filename);
  await fs.writeFile(filePath, params.content, "utf-8");

  const stat = await fs.stat(filePath);
  const relPath = path.relative(ws, filePath);

  return {
    id: params.filename.replace(/\.[^/.]+$/, ""),
    filename: params.filename,
    relativePath: relPath,
    category: params.category || "documentkb",
    agent: params.agent,
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
    preview: params.content.slice(0, 300),
  };
}

/**
 * Lists all knowledge documents in the active space.
 */
export async function listKnowledgeDocuments(
  workspaceDir: string = getWorkspaceDir(),
  space: string = CONFIG.DEFAULT_SPACE
): Promise<KnowledgeDocument[]> {
  const kDir = getKnowledgeDir(workspaceDir, space);
  const docs: KnowledgeDocument[] = [];

  async function walk(dir: string, category: "shared" | "agent" | "documentkb", agentName?: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "aidlc-shared") {
            await walk(fullPath, "shared");
          } else if (entry.name === "documents") {
            await walk(fullPath, "documentkb");
          } else {
            await walk(fullPath, "agent", entry.name);
          }
        } else if (entry.isFile() && !entry.name.startsWith(".")) {
          try {
            const stat = await fs.stat(fullPath);
            const content = await fs.readFile(fullPath, "utf-8");
            docs.push({
              id: entry.name.replace(/\.[^/.]+$/, ""),
              filename: entry.name,
              relativePath: path.relative(workspaceDir, fullPath),
              category,
              agent: agentName,
              sizeBytes: stat.size,
              updatedAt: stat.mtime.toISOString(),
              preview: content.slice(0, 200),
            });
          } catch {}
        }
      }
    } catch {}
  }

  await walk(kDir, "documentkb");
  return docs;
}

/**
 * Reads a knowledge document by relative path or filename.
 */
export async function readKnowledgeDocument(
  identifier: string,
  workspaceDir: string = getWorkspaceDir(),
  space: string = CONFIG.DEFAULT_SPACE
): Promise<{ filename: string; relativePath: string; content: string } | null> {
  const docs = await listKnowledgeDocuments(workspaceDir, space);
  const matched = docs.find((d) => d.id === identifier || d.filename === identifier || d.relativePath.endsWith(identifier));
  if (!matched) return null;

  const fullPath = path.join(workspaceDir, matched.relativePath);
  const content = await fs.readFile(fullPath, "utf-8");
  return {
    filename: matched.filename,
    relativePath: matched.relativePath,
    content,
  };
}
