import fs from "node:fs/promises";
import path from "node:path";
import { getKnowledgeDir, getWorkspaceDir, CONFIG } from "../config.js";
import { KnowledgeDocument } from "../types.js";
import { getAllCoreKnowledgeDocs, getCoreKnowledgeDoc } from "../knowledge/registry.js";

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
  const workspaceDocs: KnowledgeDocument[] = [];

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
            workspaceDocs.push({
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

  // Merge built-in core knowledge documents
  const coreDocs: KnowledgeDocument[] = getAllCoreKnowledgeDocs().map((c) => ({
    id: c.id,
    filename: c.filename,
    relativePath: `core/knowledge/${c.relativePath}`,
    category: c.category,
    agent: c.agent,
    sizeBytes: c.sizeBytes,
    updatedAt: new Date().toISOString(),
    preview: c.preview,
  }));

  const workspaceIds = new Set(workspaceDocs.map((d) => d.id));
  const filteredCore = coreDocs.filter((c) => !workspaceIds.has(c.id));

  return [...workspaceDocs, ...filteredCore];
}

/**
 * Reads a knowledge document by relative path, filename, or ID.
 */
export async function readKnowledgeDocument(
  identifier: string,
  workspaceDir: string = getWorkspaceDir(),
  space: string = CONFIG.DEFAULT_SPACE
): Promise<{ filename: string; relativePath: string; content: string } | null> {
  const docs = await listKnowledgeDocuments(workspaceDir, space);
  const matched = docs.find(
    (d) => d.id === identifier || d.filename === identifier || d.relativePath.endsWith(identifier)
  );

  if (!matched) {
    const core = getCoreKnowledgeDoc(identifier);
    if (core) {
      return {
        filename: core.filename,
        relativePath: `core/knowledge/${core.relativePath}`,
        content: core.content,
      };
    }
    return null;
  }

  if (matched.relativePath.startsWith("core/knowledge/")) {
    const core = getCoreKnowledgeDoc(matched.id) || getCoreKnowledgeDoc(matched.filename);
    if (core) {
      return {
        filename: core.filename,
        relativePath: matched.relativePath,
        content: core.content,
      };
    }
  }

  try {
    const fullPath = path.join(workspaceDir, matched.relativePath);
    const content = await fs.readFile(fullPath, "utf-8");
    return {
      filename: matched.filename,
      relativePath: matched.relativePath,
      content,
    };
  } catch {
    return null;
  }
}
