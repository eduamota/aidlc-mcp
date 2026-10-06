import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sensorsDir = path.join(rootDir, "src", "sensors");

const files = execSync(`find "${sensorsDir}" -name "aidlc-*.md"`).toString().trim().split("\n").filter(Boolean);

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
  const { frontmatter } = parseFrontmatter(text);
  const id = frontmatter.id || path.basename(file, ".md").replace("aidlc-", "");

  specs[id] = {
    id,
    kind: frontmatter.kind || "deterministic",
    command: frontmatter.command || "",
    defaultSeverity: frontmatter.default_severity || "advisory",
    fireOn: frontmatter.fire_on || (id === "type-check" || id === "linter" ? "code" : "gate"),
    description: frontmatter.description || "",
    category: frontmatter.category || "general",
    matches: frontmatter.matches || "",
    timeoutSeconds: frontmatter.timeout_seconds || 300,
    markdown: text,
  };
}

const code = `/**
 * Official AI-DLC Sensor Specifications generated from awslabs/aidlc-workflows/core/sensors/
 * Total sensors: ${Object.keys(specs).length}
 */

export interface SensorSpec {
  id: string;
  kind: string;
  command: string;
  defaultSeverity: "advisory" | "strict" | string;
  fireOn: "gate" | "code" | string;
  description: string;
  category: "document-provenance" | "document-shape" | "document-traceability" | "code-quality" | string;
  matches: string;
  timeoutSeconds: number;
  markdown: string;
}

export const SENSOR_SPECS: Record<string, SensorSpec> = ${JSON.stringify(specs, null, 2)};

export function getSensorSpec(id: string): SensorSpec | undefined {
  return SENSOR_SPECS[id];
}

export function getAllSensorSpecs(): SensorSpec[] {
  return Object.values(SENSOR_SPECS);
}
`;

fs.writeFileSync(path.join(sensorsDir, "registry.ts"), code, "utf-8");
console.log(`Successfully generated ${Object.keys(specs).length} sensor specs in ${path.join(sensorsDir, "registry.ts")}`);
