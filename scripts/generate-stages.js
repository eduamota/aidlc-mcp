import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const stagesDir = path.join(rootDir, "src", "stages");

const files = execSync(`find "${stagesDir}" -name "*.md"`).toString().trim().split("\n");

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };
  const rawYaml = match[1];
  const body = match[2];
  const frontmatter = {};

  const lines = rawYaml.split("\n");
  let currentKey = null;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const arrayItemMatch = line.match(/^\s*-\s*(.*)$/);
    if (arrayItemMatch && currentKey) {
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      const val = arrayItemMatch[1].trim();
      if (val.startsWith("artifact:")) {
        frontmatter[currentKey].push({ artifact: val.replace("artifact:", "").trim() });
      } else {
        frontmatter[currentKey].push(val);
      }
      continue;
    }

    const kvMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (val === "" || val === "[]") {
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
  const content = fs.readFileSync(file, "utf8");
  const { frontmatter } = parseFrontmatter(content);
  const slug = frontmatter.slug;
  if (!slug) continue;

  specs[slug] = {
    slug,
    name: frontmatter.name || slug.split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" "),
    phase: frontmatter.phase || "unknown",
    execution: frontmatter.execution || "ALWAYS",
    condition: frontmatter.condition || "",
    lead_agent: frontmatter.lead_agent || "",
    support_agents: frontmatter.support_agents || [],
    mode: frontmatter.mode || "inline",
    summary_confirmation: frontmatter.summary_confirmation || "",
    reviewer: frontmatter.reviewer || "",
    review_artifact: frontmatter.review_artifact || "",
    review_class: frontmatter.review_class || "",
    produces: frontmatter.produces || [],
    consumes: frontmatter.consumes || [],
    requires_stage: frontmatter.requires_stage || [],
    sensors: frontmatter.sensors || [],
    scopes: frontmatter.scopes || [],
    inputs: frontmatter.inputs || "",
    outputs: frontmatter.outputs || "",
    frontmatter,
    markdown: content,
  };
}

const tsContent = `/**
 * Official AI-DLC Stage Specifications generated from awslabs/aidlc-workflows/core/aidlc-common/stages/
 * Total stages: ${Object.keys(specs).length}
 */

export interface StageSpec {
  slug: string;
  name: string;
  phase: string;
  execution: string;
  condition?: string;
  lead_agent?: string;
  support_agents?: string[];
  mode?: string;
  summary_confirmation?: string;
  reviewer?: string;
  review_artifact?: string;
  review_class?: string;
  produces: Array<string | { artifact: string }>;
  consumes: Array<string | { artifact: string }>;
  requires_stage: string[];
  sensors: string[];
  scopes: string[];
  inputs?: string;
  outputs?: string;
  frontmatter: Record<string, any>;
  markdown: string;
}

export const STAGE_SPECS: Record<string, StageSpec> = ${JSON.stringify(specs, null, 2)};

const ALIASES: Record<string, string> = {
  "state-initialization": "state-init",
  "feasibility-constraints": "feasibility",
  "feedback-reflection": "feedback-optimization",
};

/**
 * Retrieve the full official stage specification by stage ID or slug.
 */
export function getStageSpec(idOrSlug: string): StageSpec | undefined {
  const canonical = ALIASES[idOrSlug] || idOrSlug;
  return STAGE_SPECS[canonical];
}

/**
 * List all available official stage specifications.
 */
export function getAllStageSpecs(): StageSpec[] {
  return Object.values(STAGE_SPECS);
}

/**
 * Get raw markdown content for a stage specification.
 */
export function getStageMarkdown(idOrSlug: string): string | undefined {
  const spec = getStageSpec(idOrSlug);
  return spec ? spec.markdown : undefined;
}
`;

const outputPath = path.join(rootDir, "src", "stages", "registry.ts");
fs.writeFileSync(outputPath, tsContent, "utf8");
console.log(`Successfully generated ${Object.keys(specs).length} stage specs in ${outputPath}`);
