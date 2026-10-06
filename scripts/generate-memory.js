import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const memoryDir = path.join(rootDir, "src", "memory");

const files = execSync(`find "${memoryDir}" -name "*.md"`).toString().trim().split("\n");

const memoryMap = {};

for (const file of files) {
  if (!file || !fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const relPath = path.relative(memoryDir, file);
  // e.g. org.md -> org, phases/ideation.md -> phases/ideation
  const key = relPath.replace(/\.md$/, "");
  memoryMap[key] = content;
  memoryMap[relPath] = content;
}

const tsContent = `/**
 * Official AI-DLC Memory Defaults generated from awslabs/aidlc-workflows/core/memory/
 * Total memory templates: ${Object.keys(memoryMap).length}
 */

export const MEMORY_DEFAULTS: Record<string, string> = ${JSON.stringify(memoryMap, null, 2)};

/**
 * Retrieve a default memory template by key (e.g. 'org', 'team', 'project', 'phases/inception').
 */
export function getMemoryDefault(key: string): string | undefined {
  return MEMORY_DEFAULTS[key] || MEMORY_DEFAULTS[\`\${key}.md\`];
}

/**
 * Get all default memory templates.
 */
export function getAllMemoryDefaults(): Record<string, string> {
  return MEMORY_DEFAULTS;
}
`;

const outputPath = path.join(rootDir, "src", "memory", "registry.ts");
fs.writeFileSync(outputPath, tsContent, "utf8");
console.log(`Successfully generated memory registry with ${Object.keys(memoryMap).length} keys in ${outputPath}`);
