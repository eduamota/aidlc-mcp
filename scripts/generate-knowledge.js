import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const knowledgeDir = path.join(rootDir, "src", "knowledge");

const files = execSync(`find "${knowledgeDir}" -name "*.md"`).toString().trim().split("\n");

const docs = [];
const docMap = {};

for (const file of files) {
  if (!file || !fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const relPath = path.relative(knowledgeDir, file);
  const parts = relPath.split(path.sep);
  const dirName = parts[0];
  const filename = parts[parts.length - 1];
  const id = filename.replace(/\.md$/, "");

  const isShared = dirName === "aidlc-shared";
  const category = isShared ? "shared" : "agent";
  const agent = isShared ? undefined : dirName;

  // Extract title
  const h1Match = content.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1].trim() : id.split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");

  // Extract preview
  const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("#"));
  const preview = lines.slice(0, 3).join(" ").substring(0, 160) + "...";

  const doc = {
    id,
    title,
    filename,
    relativePath: relPath,
    category,
    agent,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    preview,
    content,
  };

  docs.push(doc);
  docMap[relPath] = doc;
  // Also register by ID if not collision or prefix with agent
  if (!docMap[id]) {
    docMap[id] = doc;
  }
}

const tsContent = `/**
 * Official AI-DLC Knowledge Base generated from awslabs/aidlc-workflows/core/knowledge/
 * Total core documents: ${docs.length}
 */

export interface CoreKnowledgeDoc {
  id: string;
  title: string;
  filename: string;
  relativePath: string;
  category: "shared" | "agent";
  agent?: string;
  sizeBytes: number;
  preview: string;
  content: string;
}

export const CORE_KNOWLEDGE_LIST: CoreKnowledgeDoc[] = ${JSON.stringify(docs, null, 2)};

export const CORE_KNOWLEDGE_MAP: Record<string, CoreKnowledgeDoc> = ${JSON.stringify(docMap, null, 2)};

/**
 * Retrieve a core knowledge document by ID, relative path, or filename.
 */
export function getCoreKnowledgeDoc(identifier: string): CoreKnowledgeDoc | undefined {
  if (CORE_KNOWLEDGE_MAP[identifier]) {
    return CORE_KNOWLEDGE_MAP[identifier];
  }

  const cleanId = identifier.replace(/\\.md$/, "");
  if (CORE_KNOWLEDGE_MAP[cleanId]) {
    return CORE_KNOWLEDGE_MAP[cleanId];
  }

  return CORE_KNOWLEDGE_LIST.find(
    (d) => d.id === cleanId || d.filename === identifier || d.relativePath.endsWith(identifier)
  );
}

/**
 * List all built-in core knowledge documents.
 */
export function getAllCoreKnowledgeDocs(): CoreKnowledgeDoc[] {
  return CORE_KNOWLEDGE_LIST;
}
`;

const outputPath = path.join(rootDir, "src", "knowledge", "registry.ts");
fs.writeFileSync(outputPath, tsContent, "utf8");
console.log(`Successfully generated ${docs.length} core knowledge documents in ${outputPath}`);
