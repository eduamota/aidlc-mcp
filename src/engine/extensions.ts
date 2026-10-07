import fs from "node:fs";
import path from "node:path";
import { getWorkspaceDir, CONFIG } from "../config.js";
import {
  Phase,
  ScopeType,
  DepthLevel,
  TestStrategy,
  StageDefinition,
  RubricDimension,
  ProjectType,
} from "../types.js";
import { ScopeDefinition } from "./profiles.js";
import { ScopeSpec } from "../scopes/registry.js";
import { StageSpec } from "../stages/registry.js";
import { SensorSpec } from "../sensors/registry.js";

export interface CustomExtensionPack {
  tier: "tier2-org" | "tier3-workspace";
  sourcePath: string;
  manifest?: {
    name: string;
    version?: string;
    description?: string;
    author?: string;
  };
  scopes: Record<string, ScopeDefinition>;
  stages: Record<string, StageDefinition>;
  stageSpecs: Record<string, StageSpec>;
  scopeSpecs: Record<string, ScopeSpec>;
  sensors: Record<string, SensorSpec>;
  knowledge: Array<{
    id: string;
    title: string;
    category: string;
    content: string;
    filePath: string;
  }>;
}

export interface ExtensionRegistryCache {
  workspaceDir: string;
  packs: CustomExtensionPack[];
  scopes: Record<string, ScopeDefinition>;
  scopeSpecs: Record<string, ScopeSpec>;
  stages: Record<string, StageDefinition>;
  stageSpecs: Record<string, StageSpec>;
  sensors: Record<string, SensorSpec>;
  knowledge: Array<{
    id: string;
    title: string;
    category: string;
    content: string;
    filePath: string;
  }>;
}

let activeCache: ExtensionRegistryCache | null = null;

function parseFrontmatter(text: string): { frontmatter: Record<string, any>; body: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };
  const rawYaml = match[1];
  const body = match[2];
  const frontmatter: Record<string, any> = {};

  const lines = rawYaml.split("\n");
  let currentKey: string | null = null;
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

/**
 * Loads a single extension pack directory and parses scopes, stages, knowledge, and sensors.
 */
function loadExtensionPack(sourcePath: string, tier: "tier2-org" | "tier3-workspace"): CustomExtensionPack | null {
  if (!fs.existsSync(sourcePath)) return null;

  try {
    const stat = fs.statSync(sourcePath);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }

  const pack: CustomExtensionPack = {
    tier,
    sourcePath,
    scopes: {},
    stages: {},
    stageSpecs: {},
    scopeSpecs: {},
    sensors: {},
    knowledge: [],
  };

  // 1. Optional manifest
  const manifestFile = path.join(sourcePath, "aidlc-pack.json");
  if (fs.existsSync(manifestFile)) {
    try {
      pack.manifest = JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
    } catch {}
  }

  // 2. Custom Scopes (scopes/)
  const scopesDir = path.join(sourcePath, "scopes");
  if (fs.existsSync(scopesDir)) {
    loadScopesFromDir(scopesDir, pack);
  }

  // 3. Custom Stages (stages/)
  const stagesDir = path.join(sourcePath, "stages");
  if (fs.existsSync(stagesDir)) {
    loadStagesFromDir(stagesDir, pack);
  }

  // 4. Custom Knowledge (knowledge/)
  const knowledgeDir = path.join(sourcePath, "knowledge");
  if (fs.existsSync(knowledgeDir)) {
    loadKnowledgeFromDir(knowledgeDir, pack);
  }

  // 5. Custom Sensors (sensors/)
  const sensorsDir = path.join(sourcePath, "sensors");
  if (fs.existsSync(sensorsDir)) {
    loadSensorsFromDir(sensorsDir, pack);
  }

  return pack;
}

function loadScopesFromDir(scopesDir: string, pack: CustomExtensionPack) {
  try {
    const entries = fs.readdirSync(scopesDir, { withFileTypes: true });
    for (const ent of entries) {
      let scopeFile = "";
      let scopeName = "";

      if (ent.isDirectory()) {
        scopeName = ent.name;
        const candidateMd = path.join(scopesDir, ent.name, "SCOPE.md");
        const candidateJson = path.join(scopesDir, ent.name, "scope.json");
        if (fs.existsSync(candidateMd)) scopeFile = candidateMd;
        else if (fs.existsSync(candidateJson)) scopeFile = candidateJson;
      } else if (ent.isFile()) {
        if (ent.name.endsWith(".md")) {
          scopeName = ent.name.replace(/\.md$/, "");
          scopeFile = path.join(scopesDir, ent.name);
        } else if (ent.name.endsWith(".json")) {
          scopeName = ent.name.replace(/\.json$/, "");
          scopeFile = path.join(scopesDir, ent.name);
        }
      }

      if (!scopeFile || !scopeName) continue;

      try {
        const raw = fs.readFileSync(scopeFile, "utf-8");
        if (scopeFile.endsWith(".json")) {
          const parsed = JSON.parse(raw);
          const scopeDef: ScopeDefinition = {
            type: scopeName as ScopeType,
            name: parsed.name || scopeName,
            description: parsed.description || "",
            defaultDepth: parsed.depth || parsed.defaultDepth || "standard",
            defaultTestStrategy: parsed.testStrategy || parsed.defaultTestStrategy || "standard",
            stageIds: parsed.stageIds || parsed.stages || [],
          };
          pack.scopes[scopeName] = scopeDef;
          pack.scopeSpecs[scopeName] = {
            name: scopeName as any,
            depth: scopeDef.defaultDepth,
            testStrategy: scopeDef.defaultTestStrategy,
            description: scopeDef.description,
            guardPolicy: parsed.guardPolicy || "relaxed",
            skeleton: (parsed.skeleton === true || parsed.skeleton === "on") ? "on" : "off",
            sensors: (parsed.sensors === "on" || parsed.sensors === true) ? "on" : "off",
            learnings: (parsed.learnings === "on" || parsed.learnings === true) ? "on" : "off",
            summaryConfirmation: (parsed.summaryConfirmation === true || parsed.summaryConfirmation === "on") ? "on" : "off",
            planApproval: (parsed.planApproval === true || parsed.planApproval === "on") ? "on" : "off",
            collaborators: (parsed.collaborators === "on" || parsed.collaborators === true) ? "on" : "off",
            keywords: parsed.keywords || [],
            markdown: raw,
          };
        } else {
          // Markdown with frontmatter
          const { frontmatter, body } = parseFrontmatter(raw);
          const stages = Array.isArray(frontmatter.stages)
            ? frontmatter.stages
            : Array.isArray(frontmatter.stageIds)
            ? frontmatter.stageIds
            : [];

          const scopeDef: ScopeDefinition = {
            type: scopeName as ScopeType,
            name: frontmatter.name || scopeName,
            description: frontmatter.description || "",
            defaultDepth: frontmatter.depth || frontmatter.defaultDepth || "standard",
            defaultTestStrategy: frontmatter["test-strategy"] || frontmatter.defaultTestStrategy || "standard",
            stageIds: stages,
          };

          pack.scopes[scopeName] = scopeDef;
          pack.scopeSpecs[scopeName] = {
            name: scopeName as any,
            depth: scopeDef.defaultDepth,
            testStrategy: scopeDef.defaultTestStrategy,
            description: scopeDef.description,
            guardPolicy: frontmatter["guard-policy"] || "relaxed",
            skeleton: (frontmatter.skeleton === true || frontmatter.skeleton === "on") ? "on" : "off",
            sensors: (frontmatter.sensors === "on" || frontmatter.sensors === true) ? "on" : "off",
            learnings: (frontmatter.learnings === "on" || frontmatter.learnings === true) ? "on" : "off",
            summaryConfirmation: (frontmatter["summary-confirmation"] === true || frontmatter["summary-confirmation"] === "on") ? "on" : "off",
            planApproval: (frontmatter["plan-approval"] === true || frontmatter["plan-approval"] === "on") ? "on" : "off",
            collaborators: (frontmatter.collaborators === "on" || frontmatter.collaborators === true) ? "on" : "off",
            keywords: frontmatter.keywords || [],
            markdown: raw,
          };
        }
      } catch (err: any) {
        console.error(`[ai-dlc-mcp] Failed to load custom scope '${scopeName}': ${err.message}`);
      }
    }
  } catch {}
}

function loadStagesFromDir(stagesDir: string, pack: CustomExtensionPack) {
  try {
    const entries = fs.readdirSync(stagesDir, { withFileTypes: true });
    for (const ent of entries) {
      let stageFile = "";
      let stageId = "";
      let rubricFile = "";

      if (ent.isDirectory()) {
        stageId = ent.name;
        const candidateMd = path.join(stagesDir, ent.name, "STAGE.md");
        const candidateJson = path.join(stagesDir, ent.name, "stage.json");
        const candidateRubric = path.join(stagesDir, ent.name, "rubric.json");
        if (fs.existsSync(candidateMd)) stageFile = candidateMd;
        else if (fs.existsSync(candidateJson)) stageFile = candidateJson;
        if (fs.existsSync(candidateRubric)) rubricFile = candidateRubric;
      } else if (ent.isFile()) {
        if (ent.name.endsWith(".md")) {
          stageId = ent.name.replace(/\.md$/, "");
          stageFile = path.join(stagesDir, ent.name);
        } else if (ent.name.endsWith(".json")) {
          stageId = ent.name.replace(/\.json$/, "");
          stageFile = path.join(stagesDir, ent.name);
        }
      }

      if (!stageFile || !stageId) continue;

      try {
        const raw = fs.readFileSync(stageFile, "utf-8");
        let rubricDimensions: RubricDimension[] = [];

        if (rubricFile && fs.existsSync(rubricFile)) {
          try {
            const rawRubric = JSON.parse(fs.readFileSync(rubricFile, "utf-8"));
            rubricDimensions = rawRubric.dimensions || rawRubric || [];
          } catch {}
        }

        if (stageFile.endsWith(".json")) {
          const parsed = JSON.parse(raw);
          const stageDef: StageDefinition = {
            id: stageId,
            number: parsed.number || "custom",
            name: parsed.name || stageId,
            phase: (parsed.phase || "inception") as Phase,
            description: parsed.description || "",
            persona: parsed.persona || "aidlc-developer-agent",
            defaultArtifactName: parsed.defaultArtifactName || `${stageId}.md`,
            rubric: {
              stageId,
              stageName: parsed.name || stageId,
              persona: parsed.persona || "aidlc-developer-agent",
              dimensions: rubricDimensions.length > 0 ? rubricDimensions : parsed.dimensions || [],
            },
          };
          pack.stages[stageId] = stageDef;
          pack.stageSpecs[stageId] = {
            slug: stageId,
            name: stageDef.name,
            phase: stageDef.phase,
            execution: "manual",
            lead_agent: stageDef.persona,
            produces: parsed.deliverables || [stageDef.defaultArtifactName],
            consumes: parsed.consumes || [],
            requires_stage: [],
            sensors: [],
            scopes: [],
            frontmatter: parsed,
            markdown: raw,
          };
        } else {
          // Markdown with frontmatter
          const { frontmatter, body } = parseFrontmatter(raw);
          const dimensions: RubricDimension[] =
            rubricDimensions.length > 0
              ? rubricDimensions
              : Array.isArray(frontmatter.dimensions)
              ? frontmatter.dimensions
              : [
                  {
                    id: `${stageId}_verification`,
                    title: `${frontmatter.name || stageId} Delivery Check`,
                    description: `Verify that ${frontmatter.name || stageId} objectives and outputs are achieved.`,
                    probingQuestions: [
                      `Are all requirements and success criteria for ${frontmatter.name || stageId} documented?`,
                      `What trade-offs or non-goals were identified during this stage?`,
                    ],
                    heuristicKeywords: [stageId, "verified", "complete", "architecture"],
                  },
                ];

          const stageDef: StageDefinition = {
            id: stageId,
            number: frontmatter.number || "custom",
            name: frontmatter.name || stageId,
            phase: (frontmatter.phase || "inception") as Phase,
            description: frontmatter.description || "",
            persona: frontmatter.persona || "aidlc-developer-agent",
            defaultArtifactName: frontmatter["default-artifact-name"] || `${stageId}.md`,
            rubric: {
              stageId,
              stageName: frontmatter.name || stageId,
              persona: frontmatter.persona || "aidlc-developer-agent",
              dimensions,
            },
          };

          pack.stages[stageId] = stageDef;
          pack.stageSpecs[stageId] = {
            slug: stageId,
            name: stageDef.name,
            phase: stageDef.phase,
            execution: frontmatter.execution || "manual",
            lead_agent: stageDef.persona,
            produces: frontmatter.deliverables || [stageDef.defaultArtifactName],
            consumes: frontmatter.consumes || [],
            requires_stage: frontmatter.requires_stage || [],
            sensors: frontmatter.sensors || [],
            scopes: frontmatter.scopes || [],
            frontmatter,
            markdown: raw,
          };
        }
      } catch (err: any) {
        console.error(`[ai-dlc-mcp] Failed to load custom stage '${stageId}': ${err.message}`);
      }
    }
  } catch {}
}

function loadKnowledgeFromDir(knowledgeDir: string, pack: CustomExtensionPack) {
  try {
    const files = fs.readdirSync(knowledgeDir, { recursive: true }) as string[];
    for (const f of files) {
      if (typeof f !== "string" || !f.endsWith(".md")) continue;
      const fullPath = path.join(knowledgeDir, f);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        const text = fs.readFileSync(fullPath, "utf-8");
        const docId = f.replace(/\.md$/, "").replace(/[\/\\]/g, "-");
        pack.knowledge.push({
          id: `ext-${docId}`,
          title: path.basename(f, ".md"),
          category: "custom-extension",
          content: text,
          filePath: fullPath,
        });
      } catch {}
    }
  } catch {}
}

function loadSensorsFromDir(sensorsDir: string, pack: CustomExtensionPack) {
  try {
    const entries = fs.readdirSync(sensorsDir, { withFileTypes: true });
    for (const ent of entries) {
      let sensorFile = "";
      let sensorId = "";

      if (ent.isDirectory()) {
        sensorId = ent.name;
        const candidateMd = path.join(sensorsDir, ent.name, "SENSOR.md");
        const candidateJson = path.join(sensorsDir, ent.name, "sensor.json");
        if (fs.existsSync(candidateMd)) sensorFile = candidateMd;
        else if (fs.existsSync(candidateJson)) sensorFile = candidateJson;
      } else if (ent.isFile() && ent.name.endsWith(".md")) {
        sensorId = ent.name.replace(/\.md$/, "");
        sensorFile = path.join(sensorsDir, ent.name);
      }

      if (!sensorFile || !sensorId) continue;

      try {
        const raw = fs.readFileSync(sensorFile, "utf-8");
        const { frontmatter } = parseFrontmatter(raw);
        pack.sensors[sensorId] = {
          id: sensorId,
          kind: frontmatter.kind || "custom",
          command: frontmatter.command || "",
          category: frontmatter.category || "custom",
          defaultSeverity: frontmatter.severity || frontmatter.defaultSeverity || "advisory",
          fireOn: frontmatter["fire-on"] || frontmatter.fireOn || "gate",
          description: frontmatter.description || `Custom sensor ${sensorId}`,
          matches: frontmatter.matches || "*.md",
          timeoutSeconds: frontmatter.timeoutSeconds || 5,
          markdown: raw,
        };
      } catch {}
    }
  } catch {}
}

/**
 * Scans Tier 2 (Org Repo / AIDLC_FLOWS_DIR) and Tier 3 (Workspace Local .aidlc/ or aidlc/custom/).
 */
export function loadAllExtensions(workspaceDir?: string): ExtensionRegistryCache {
  const ws = workspaceDir || getWorkspaceDir();

  // If already cached for this workspace, return cache
  if (activeCache && activeCache.workspaceDir === ws) {
    return activeCache;
  }

  const packs: CustomExtensionPack[] = [];

  // Tier 2: Organization Flow Repository / AIDLC_FLOWS_DIR
  const orgFlowsDir = process.env.AIDLC_FLOWS_DIR || process.env.AIDLC_EXTENSIONS_DIR;
  if (orgFlowsDir) {
    const resolvedOrg = path.isAbsolute(orgFlowsDir) ? orgFlowsDir : path.resolve(ws, orgFlowsDir);
    const orgPack = loadExtensionPack(resolvedOrg, "tier2-org");
    if (orgPack) {
      packs.push(orgPack);
    }
  }

  // Tier 3: Workspace Local (.aidlc/ or aidlc/custom/) - only if valid project workspace
  if (ws && ws !== "/") {
    const localDotAidlc = path.join(ws, ".aidlc");
    const localDotPack = loadExtensionPack(localDotAidlc, "tier3-workspace");
    if (localDotPack) {
      packs.push(localDotPack);
    }

    const localAidlcCustom = path.join(ws, "aidlc", "custom");
    const localCustomPack = loadExtensionPack(localAidlcCustom, "tier3-workspace");
    if (localCustomPack) {
      packs.push(localCustomPack);
    }
  }

  // Aggregate into merged caches
  const mergedScopes: Record<string, ScopeDefinition> = {};
  const mergedScopeSpecs: Record<string, ScopeSpec> = {};
  const mergedStages: Record<string, StageDefinition> = {};
  const mergedStageSpecs: Record<string, StageSpec> = {};
  const mergedSensors: Record<string, SensorSpec> = {};
  const mergedKnowledge: CustomExtensionPack["knowledge"] = [];

  for (const p of packs) {
    Object.assign(mergedScopes, p.scopes);
    Object.assign(mergedScopeSpecs, p.scopeSpecs);
    Object.assign(mergedStages, p.stages);
    Object.assign(mergedStageSpecs, p.stageSpecs);
    Object.assign(mergedSensors, p.sensors);
    mergedKnowledge.push(...p.knowledge);
  }

  activeCache = {
    workspaceDir: ws,
    packs,
    scopes: mergedScopes,
    scopeSpecs: mergedScopeSpecs,
    stages: mergedStages,
    stageSpecs: mergedStageSpecs,
    sensors: mergedSensors,
    knowledge: mergedKnowledge,
  };

  return activeCache;
}

/**
 * Clears the active cache (useful during testing or when files are edited).
 */
export function clearExtensionCache(): void {
  activeCache = null;
}

export function getCustomScopeDefinition(name: string, workspaceDir?: string): ScopeDefinition | undefined {
  const cache = loadAllExtensions(workspaceDir);
  return cache.scopes[name];
}

export function getAllCustomScopes(workspaceDir?: string): ScopeDefinition[] {
  const cache = loadAllExtensions(workspaceDir);
  return Object.values(cache.scopes);
}

export function getCustomScopeSpec(name: string, workspaceDir?: string): ScopeSpec | undefined {
  const cache = loadAllExtensions(workspaceDir);
  return cache.scopeSpecs[name];
}

export function getAllCustomScopeSpecs(workspaceDir?: string): ScopeSpec[] {
  const cache = loadAllExtensions(workspaceDir);
  return Object.values(cache.scopeSpecs);
}

export function getCustomStageDefinition(id: string, workspaceDir?: string): StageDefinition | undefined {
  const cache = loadAllExtensions(workspaceDir);
  return cache.stages[id];
}

export function getAllCustomStages(workspaceDir?: string): StageDefinition[] {
  const cache = loadAllExtensions(workspaceDir);
  return Object.values(cache.stages);
}

export function getCustomStageSpec(slug: string, workspaceDir?: string): StageSpec | undefined {
  const cache = loadAllExtensions(workspaceDir);
  return cache.stageSpecs[slug];
}

export function getAllCustomStageSpecs(workspaceDir?: string): StageSpec[] {
  const cache = loadAllExtensions(workspaceDir);
  return Object.values(cache.stageSpecs);
}

export function getCustomSensors(workspaceDir?: string): SensorSpec[] {
  const cache = loadAllExtensions(workspaceDir);
  return Object.values(cache.sensors);
}

export function getCustomKnowledgeDocs(workspaceDir?: string) {
  const cache = loadAllExtensions(workspaceDir);
  return cache.knowledge;
}
