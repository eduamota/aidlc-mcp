import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getWorkspaceDir, getSpaceDir, getMemoryDir, CONFIG } from "../config.js";
import { getSensorSpec } from "../sensors/registry.js";
import { getStageSpec } from "../stages/registry.js";
import { appendAuditLog } from "./audit.js";

export interface SensorFinding {
  sensorId: string;
  pass: boolean;
  severity: "advisory" | "strict";
  findings: string[];
  details?: Record<string, any>;
}

export interface StageSensorsReport {
  stageSlug: string;
  overallPass: boolean;
  results: SensorFinding[];
}

/**
 * 1. required-sections sensor:
 * Checks output contains at least 2 H2 headings.
 * For unit-of-work-dependency.md, validates the YAML DAG for syntax and cycles.
 * Checks against template overrides in memory/templates/ if present.
 */
export async function evaluateRequiredSections(params: {
  content: string;
  filename?: string;
  space?: string;
  workspaceDir?: string;
}): Promise<SensorFinding> {
  const ws = params.workspaceDir || getWorkspaceDir();
  const space = params.space || CONFIG.DEFAULT_SPACE;
  const filename = params.filename || "output.md";
  const findings: string[] = [];

  // Timestamp markers always pass
  if (filename.endsWith("-timestamp.md")) {
    return {
      sensorId: "required-sections",
      pass: true,
      severity: "advisory",
      findings: ["Timestamp marker file automatically passes."],
      details: { h2_count: 0, edge_block: "ok" },
    };
  }

  // Extract all H2 headings (strip emoji decoration if present)
  const lines = params.content.split(/\r?\n/);
  const headings: string[] = [];
  for (const line of lines) {
    const match = line.match(/^##\s+(?:[\p{Emoji}\u200d\s]*\s+)?(.+)$/u);
    if (match) {
      headings.push(match[1].trim());
    }
  }

  // Check template override if present
  let templateExpected: string[] = [];
  let templateMissing: string[] = [];
  const templatePath = path.join(getMemoryDir(ws, space), "templates", filename);
  try {
    const tmplContent = await fs.readFile(templatePath, "utf-8");
    for (const line of tmplContent.split(/\r?\n/)) {
      const match = line.match(/^##\s+(?:[\p{Emoji}\u200d\s]*\s+)?(.+)$/u);
      if (match) {
        templateExpected.push(match[1].trim().toLowerCase());
      }
    }

    if (templateExpected.length > 0) {
      const lowerHeadings = headings.map((h) => h.toLowerCase());
      templateMissing = templateExpected.filter((exp) => !lowerHeadings.some((h) => h.includes(exp)));
      if (templateMissing.length > 0) {
        findings.push(`Missing required headings from template '${filename}': ${templateMissing.join(", ")}`);
      }
    }
  } catch {
    // No template override present, fall back to >= 2 H2 floor
  }

  if (templateExpected.length === 0 && headings.length < 2) {
    findings.push(`Artifact contains only ${headings.length} H2 heading(s); minimum of 2 required.`);
  }

  // Special check for unit-of-work-dependency.md DAG
  let edgeBlockStatus = "ok";
  if (filename.includes("unit-of-work") || filename.includes("dependency")) {
    const yamlBlockMatch = params.content.match(/```ya?ml[\r\n]+([\s\S]*?)```/);
    if (!yamlBlockMatch || !yamlBlockMatch[1].includes("units:")) {
      edgeBlockStatus = "absent";
      findings.push("Missing fenced YAML 'units:' block in unit dependency specification.");
    } else {
      try {
        const units = parseSimpleYamlUnits(yamlBlockMatch[1]);
        const cycle = detectDagCycle(units);
        if (cycle) {
          edgeBlockStatus = "cyclic";
          findings.push(`Circular dependency cycle detected in Unit DAG: ${cycle.join(" -> ")}`);
        }
      } catch (err: any) {
        edgeBlockStatus = "malformed";
        findings.push(`Malformed YAML in Unit DAG: ${err.message}`);
      }
    }
  }

  const pass = findings.length === 0;
  return {
    sensorId: "required-sections",
    pass,
    severity: "advisory",
    findings,
    details: {
      h2_count: headings.length,
      headings,
      edge_block: edgeBlockStatus,
      template_missing: templateMissing,
    },
  };
}

/**
 * 2. claim-sources sensor:
 * Checks Intent Capture deliverables carry inline source tags ([desc], [scope], [Q<n>], [memory:...], [assumption]).
 */
export async function evaluateClaimSources(params: {
  content: string;
  projectDescription?: string;
  scope?: string;
}): Promise<SensorFinding> {
  const findings: string[] = [];

  // 1. Must contain ## Assumptions & Open Questions
  const hasAssumptionsSection = /^##\s+.*Assumptions\s+&\s+Open\s+Questions/im.test(params.content);
  if (!hasAssumptionsSection) {
    findings.push("Missing required section: '## Assumptions & Open Questions'");
  }

  // 2. Count substantive claims and verify provenance tags
  const lines = params.content.split(/\r?\n/);
  let totalClaims = 0;
  let taggedClaims = 0;
  let inCodeBlock = false;
  let inAssumptions = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (/^##\s+.*Assumptions/i.test(line)) {
      inAssumptions = true;
    } else if (/^##\s+/i.test(line)) {
      inAssumptions = false;
    }

    if (inCodeBlock || !line || line.startsWith("#") || line.startsWith("|---") || line.startsWith("<!--")) {
      continue;
    }

    totalClaims++;
    const hasTag = /\[(desc|scope|Q\d+|memory:[^\]]+|assumption)\]/i.test(line);
    if (hasTag) {
      taggedClaims++;
      // [assumption] tag should only be in assumptions section
      if (line.includes("[assumption]") && !inAssumptions) {
        findings.push(`Line ${i + 1}: '[assumption]' tag appeared outside the Assumptions section.`);
      }
    }
  }

  if (totalClaims > 0 && taggedClaims === 0) {
    findings.push("No claims in the artifact carry inline provenance tags ([desc], [scope], [Q<n>], [memory:...], [assumption]).");
  }

  const pass = findings.length === 0;
  return {
    sensorId: "claim-sources",
    pass,
    severity: "advisory",
    findings,
    details: {
      totalClaims,
      taggedClaims,
      ratio: totalClaims > 0 ? (taggedClaims / totalClaims).toFixed(2) : "1.00",
    },
  };
}

/**
 * 3. traceability sensor:
 * Validates traceability.json coverage table and status values (OK, GAP, ORPHAN, Deferred, N/A).
 */
export function evaluateTraceabilityJson(jsonContent: string): SensorFinding {
  const findings: string[] = [];
  let parsed: any;

  try {
    parsed = JSON.parse(jsonContent);
  } catch (err: any) {
    return {
      sensorId: "traceability",
      pass: false,
      severity: "advisory",
      findings: [`Invalid JSON in traceability matrix: ${err.message}`],
    };
  }

  const validStatuses = new Set(["OK", "GAP", "ORPHAN", "Deferred", "N/A"]);
  const coverage = Array.isArray(parsed.coverage) ? parsed.coverage : [];

  for (let i = 0; i < coverage.length; i++) {
    const item = coverage[i];
    if (!item.id) {
      findings.push(`Coverage entry ${i} is missing an 'id'.`);
    }
    if (!validStatuses.has(item.status)) {
      findings.push(`Coverage entry ${item.id || i} has invalid status '${item.status}'. Valid: ${Array.from(validStatuses).join(", ")}`);
    }
    if (item.status === "GAP") {
      findings.push(`Traceability GAP detected for ID: ${item.id}`);
    }
    if (item.status === "OK" && !item.target) {
      findings.push(`Coverage entry ${item.id} has status OK but is missing a target.`);
    }
  }

  const reverse = Array.isArray(parsed.reverse) ? parsed.reverse : [];
  for (const r of reverse) {
    if (r.status === "ORPHAN") {
      findings.push(`Traceability ORPHAN detected for ID: ${r.id}`);
    }
  }

  return {
    sensorId: "traceability",
    pass: findings.length === 0,
    severity: "advisory",
    findings,
    details: {
      coverageCount: coverage.length,
      reverseCount: reverse.length,
    },
  };
}

/**
 * 4. upstream-coverage sensor:
 * Verifies stage deliverables cite declared upstream consumed artifacts.
 */
export function evaluateUpstreamCoverage(params: {
  consumes: (string | { artifact: string })[];
  deliverableContents: string[];
}): SensorFinding {
  const findings: string[] = [];
  const combinedText = params.deliverableContents.join("\n");
  const unreferenced: string[] = [];

  for (const item of params.consumes) {
    const upstream = typeof item === "string" ? item : item.artifact;
    if (!upstream || upstream.startsWith("conditional_on:")) continue;
    const cleanSlug = upstream.trim();

    // Check standalone token, backtick token, wikilink, or path segment
    const escaped = cleanSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:\\b${escaped}\\b|` + `\`${escaped}(?:\\.md)?\`|` + `\\[\\[${escaped}\\]\\]|` + `${escaped}/)`, "i");

    if (!re.test(combinedText)) {
      unreferenced.push(cleanSlug);
    }
  }

  if (unreferenced.length > 0) {
    findings.push(`Unreferenced consumed upstream artifacts: ${unreferenced.map((u) => `\`${u}\``).join(", ")}`);
  }

  return {
    sensorId: "upstream-coverage",
    pass: findings.length === 0,
    severity: "advisory",
    findings,
    details: {
      declaredConsumes: params.consumes.length,
      unreferenced,
    },
  };
}

/**
 * Orchestrates running applicable sensors for a stage.
 */
export async function runStageSensors(params: {
  stageSlug: string;
  content: string;
  filename?: string;
  workspaceDir?: string;
  space?: string;
}): Promise<StageSensorsReport> {
  const ws = params.workspaceDir || getWorkspaceDir();
  const results: SensorFinding[] = [];

  // 1. Always evaluate required-sections
  const reqSec = await evaluateRequiredSections({
    content: params.content,
    filename: params.filename,
    space: params.space,
    workspaceDir: ws,
  });
  results.push(reqSec);

  // 2. Evaluate claim-sources on intent stages
  if (params.stageSlug === "intent-capture" || params.content.includes("## Assumptions")) {
    const claimRes = await evaluateClaimSources({ content: params.content });
    results.push(claimRes);
  }

  // 3. Evaluate upstream-coverage if stage declares consumes
  const spec = getStageSpec(params.stageSlug);
  if (spec && spec.consumes && spec.consumes.length > 0) {
    const upRes = evaluateUpstreamCoverage({
      consumes: spec.consumes,
      deliverableContents: [params.content],
    });
    results.push(upRes);
  }

  // 4. Traceability check if json
  if (params.filename?.endsWith("traceability.json") || params.content.includes('"upstream_ids"')) {
    const traceRes = evaluateTraceabilityJson(params.content);
    results.push(traceRes);
  }

  const overallPass = results.every((r) => r.pass);

  // Audit logging
  const correlator = crypto.randomBytes(4).toString("hex");
  await appendAuditLog({
    type: overallPass ? "SENSOR_PASSED" : "SENSOR_FAILED",
    summary: `Sensors ran for stage '${params.stageSlug}': ${overallPass ? "ALL PASSED" : "FINDINGS DETECTED"}`,
    details: {
      fireId: correlator,
      stageSlug: params.stageSlug,
      overallPass,
      sensorsCount: results.length,
      findingsCount: results.flatMap((r) => r.findings).length,
    },
  }, ws);

  return {
    stageSlug: params.stageSlug,
    overallPass,
    results,
  };
}

// Simple YAML Units parser for dependency graphs
function parseSimpleYamlUnits(yamlText: string): Map<string, string[]> {
  const units = new Map<string, string[]>();
  const lines = yamlText.split(/\r?\n/);
  let currentUnit: string | null = null;
  let currentDepends: string[] = [];

  for (const line of lines) {
    const unitMatch = line.match(/^\s*-\s*name:\s*(.+)$/i) || line.match(/^\s*-\s*id:\s*(.+)$/i);
    if (unitMatch) {
      if (currentUnit) {
        units.set(currentUnit, currentDepends);
      }
      currentUnit = unitMatch[1].trim().replace(/^["']|["']$/g, "");
      currentDepends = [];
      continue;
    }

    const depMatch = line.match(/^\s*-\s*(.+)$/);
    if (depMatch && currentUnit && !line.includes("name:") && !line.includes("kind:")) {
      const dep = depMatch[1].trim().replace(/^["']|["']$/g, "");
      if (dep && !dep.startsWith("kind:") && !dep.startsWith("depends_on:")) {
        currentDepends.push(dep);
      }
    }
  }

  if (currentUnit) {
    units.set(currentUnit, currentDepends);
  }

  return units;
}

// DFS DAG Cycle Detection
function detectDagCycle(graph: Map<string, string[]>): string[] | null {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (recStack.has(neighbor)) {
        return [...path, neighbor];
      }
    }

    recStack.delete(node);
    path.pop();
    return null;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }

  return null;
}
