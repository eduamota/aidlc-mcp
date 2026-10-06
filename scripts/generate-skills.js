import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const skillsDir = path.join(rootDir, "src", "skills");

const files = execSync(`find "${skillsDir}" -name "SKILL.md"`).toString().trim().split("\n").filter(Boolean);

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };
  const rawYaml = match[1];
  const body = match[2];
  const frontmatter = {};

  const lines = rawYaml.split("\n");
  let currentKey = null;
  let isMultilineScalar = false;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    if (currentKey && isMultilineScalar && /^\s+/.test(line)) {
      if (typeof frontmatter[currentKey] === "string") {
        frontmatter[currentKey] += (frontmatter[currentKey] ? " " : "") + line.trim();
      }
      continue;
    } else {
      isMultilineScalar = false;
    }

    const arrayItemMatch = line.match(/^\s*-\s*(.*)$/);
    if (arrayItemMatch && currentKey) {
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      const val = arrayItemMatch[1].trim().replace(/^["']|["']$/g, "");
      frontmatter[currentKey].push(val);
      continue;
    }

    const kvMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (val === ">" || val === "|") {
        isMultilineScalar = true;
        frontmatter[currentKey] = "";
      } else if (val === "" || val === "[]") {
        frontmatter[currentKey] = [];
      } else if (val === "true") {
        frontmatter[currentKey] = true;
      } else if (val === "false") {
        frontmatter[currentKey] = false;
      } else if (!isNaN(Number(val))) {
        frontmatter[currentKey] = Number(val);
      } else {
        frontmatter[currentKey] = val.replace(/^["']|["']$/g, "");
      }
    }
  }
  return { frontmatter, body };
}

const specs = {};

for (const file of files) {
  const text = fs.readFileSync(file, "utf-8");
  const { frontmatter } = parseFrontmatter(text);
  const dirName = path.basename(path.dirname(file));
  const name = frontmatter.name || dirName;

  specs[name] = {
    name,
    description: frontmatter.description || "",
    argumentHint: frontmatter["argument-hint"] || "",
    userInvocable: frontmatter["user-invocable"] !== false,
    classification: frontmatter.classification || "read-only",
    markdown: text,
  };
}

const code = `/**
 * Official AI-DLC Skill Specifications generated from awslabs/aidlc-workflows/core/skills/
 * Total skills: ${Object.keys(specs).length}
 */

export interface SkillSpec {
  name: string;
  description: string;
  argumentHint?: string;
  userInvocable: boolean;
  classification: "read-only" | "read-write" | string;
  markdown: string;
}

export const SKILL_SPECS: Record<string, SkillSpec> = ${JSON.stringify(specs, null, 2)};

export function getSkillSpec(name: string): SkillSpec | undefined {
  return SKILL_SPECS[name];
}

export function getAllSkillSpecs(): SkillSpec[] {
  return Object.values(SKILL_SPECS);
}
`;

fs.writeFileSync(path.join(skillsDir, "registry.ts"), code, "utf-8");
console.log(`Successfully generated ${Object.keys(specs).length} skill specs in ${path.join(skillsDir, "registry.ts")}`);
