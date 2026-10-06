import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const scopesDir = path.join(rootDir, "src", "scopes");

const files = execSync(`find "${scopesDir}" -name "aidlc-*.md"`).toString().trim().split("\n").filter(Boolean);

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
      const val = arrayItemMatch[1].trim().replace(/^["']|["']$/g, "");
      frontmatter[currentKey].push(val);
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
  const text = fs.readFileSync(file, "utf-8");
  const { frontmatter, body } = parseFrontmatter(text);
  const name = frontmatter.name || path.basename(file, ".md").replace("aidlc-", "");

  specs[name] = {
    name,
    depth: (frontmatter.depth || "Standard").toLowerCase(),
    testStrategy: (frontmatter.testStrategy || frontmatter.depth || "Standard").toLowerCase(),
    keywords: Array.isArray(frontmatter.keywords) ? frontmatter.keywords : [],
    description: frontmatter.description || "",
    skeleton: frontmatter.skeleton || "off",
    existingCode: !!frontmatter.existing_code,
    runner: !!frontmatter.runner,
    reviewCap: frontmatter.review_cap || (name === "enterprise" ? "strict" : "advisory"),
    guardPolicy: frontmatter.guard_policy || "off",
    sensors: frontmatter.sensors || "on",
    learnings: frontmatter.learnings || "on",
    summaryConfirmation: frontmatter.summary_confirmation || "on",
    planApproval: frontmatter.plan_approval || "on",
    collaborators: frontmatter.collaborators || "off",
    markdown: text,
  };
}

const code = `/**
 * Official AI-DLC Scope Specifications generated from awslabs/aidlc-workflows/core/scopes/
 * Total scopes: ${Object.keys(specs).length}
 */

import { ScopeType, DepthLevel, TestStrategy } from "../types.js";

export interface ScopeSpec {
  name: ScopeType;
  depth: DepthLevel;
  testStrategy: TestStrategy;
  keywords: string[];
  description: string;
  skeleton: "on" | "off";
  existingCode?: boolean;
  runner?: boolean;
  reviewCap?: "none" | "advisory" | "strict";
  guardPolicy: "off" | "strict" | "relaxed";
  sensors: "on" | "off";
  learnings: "on" | "off";
  summaryConfirmation: "on" | "off";
  planApproval: "on" | "off";
  collaborators: "on" | "off";
  markdown: string;
}

export const SCOPE_SPECS: Record<ScopeType, ScopeSpec> = ${JSON.stringify(specs, null, 2)};

export function getScopeSpec(scopeName: string): ScopeSpec | undefined {
  return SCOPE_SPECS[scopeName as ScopeType];
}

export function getAllScopeSpecs(): ScopeSpec[] {
  return Object.values(SCOPE_SPECS);
}

/**
 * Detects an appropriate scope from human prompt text based on official keyword triggers.
 */
export function detectScopeFromPrompt(text: string): ScopeType | undefined {
  if (!text) return undefined;

  // Order scopes to prioritize specific multi-word matches first (e.g. security-patch, poc, refactor, bugfix)
  const priorityOrder: ScopeType[] = [
    "security-patch",
    "poc",
    "bugfix",
    "refactor",
    "infra",
    "workshop",
    "express",
    "mvp",
    "enterprise",
    "feature",
    "classic",
  ];

  for (const scopeName of priorityOrder) {
    const spec = SCOPE_SPECS[scopeName];
    if (!spec || !spec.keywords || spec.keywords.length === 0) continue;

    for (const kw of spec.keywords) {
      const escaped = kw.replace(/[\.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
      const regex = new RegExp("\\\\b" + escaped + "\\\\b", "i");
      if (regex.test(text)) {
        return scopeName;
      }
    }
  }

  return undefined;
}
`;

fs.writeFileSync(path.join(scopesDir, "registry.ts"), code, "utf-8");
console.log(`Successfully generated ${Object.keys(specs).length} scope specs in ${path.join(scopesDir, "registry.ts")}`);
