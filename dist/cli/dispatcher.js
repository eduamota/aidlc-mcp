import fs from "node:fs";
import path from "node:path";
import { runDlcDoctor } from "../utils/doctor.js";
import { loadActiveIntentState, loadIntentState, listAllIntents, setActiveIntent, } from "../utils/filesystem.js";
import { DlcStateMachine } from "../engine/state-machine.js";
import { runStageSensors } from "../engine/sensors.js";
import { getAllSensorSpecs } from "../sensors/registry.js";
import { computeSessionCost, generateSessionReplay, generateOutcomesPack, } from "../engine/skills.js";
import { resolveActiveMemory, readMemoryLayer, updateMemoryRule, recordLearning, } from "../utils/memory.js";
import { executeHook } from "../hooks/runner.js";
import { installHooks } from "../hooks/installer.js";
import { loadAllExtensions } from "../engine/extensions.js";
export function findWorkspaceRoot(startDir = process.cwd()) {
    if (process.env.AIDLC_WORKSPACE)
        return process.env.AIDLC_WORKSPACE;
    let curr = path.resolve(startDir);
    while (curr !== path.dirname(curr)) {
        if (fs.existsSync(path.join(curr, "aidlc")) || fs.existsSync(path.join(curr, ".git"))) {
            return curr;
        }
        curr = path.dirname(curr);
    }
    return process.cwd();
}
export function parseCliArgs(rawArgs) {
    const flags = {
        json: false,
        write: false,
        help: false,
        version: false,
    };
    const positional = [];
    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        if (arg === "--json") {
            flags.json = true;
        }
        else if (arg === "--write" || arg === "-w") {
            flags.write = true;
        }
        else if (arg === "--help" || arg === "-h") {
            flags.help = true;
        }
        else if (arg === "--version" || arg === "-v") {
            flags.version = true;
        }
        else if (arg === "--workspace" && i + 1 < rawArgs.length) {
            flags.workspace = rawArgs[++i];
        }
        else if (arg === "--space" && i + 1 < rawArgs.length) {
            flags.space = rawArgs[++i];
        }
        else if (arg === "--intent" && i + 1 < rawArgs.length) {
            flags.intent = rawArgs[++i];
        }
        else if (arg === "--scope" && i + 1 < rawArgs.length) {
            flags.scope = rawArgs[++i];
        }
        else if (arg === "--depth" && i + 1 < rawArgs.length) {
            flags.depth = rawArgs[++i];
        }
        else if (arg === "--test-strategy" && i + 1 < rawArgs.length) {
            flags.testStrategy = rawArgs[++i];
        }
        else if (arg === "--notes" && i + 1 < rawArgs.length) {
            flags.notes = rawArgs[++i];
        }
        else if (arg === "--reason" && i + 1 < rawArgs.length) {
            flags.reason = rawArgs[++i];
        }
        else if (arg === "--file" && i + 1 < rawArgs.length) {
            flags.file = rawArgs[++i];
        }
        else if (arg === "--target" && i + 1 < rawArgs.length) {
            flags.target = rawArgs[++i];
        }
        else if (!arg.startsWith("-")) {
            positional.push(arg);
        }
    }
    // Handle "engine runtime summary" mapping from upstream skills
    if (positional[0] === "engine" && positional[1] === "runtime" && positional[2] === "summary") {
        return {
            command: "runtime",
            subcommand: "summary",
            args: positional.slice(3),
            flags,
        };
    }
    return {
        command: positional[0] || "",
        subcommand: positional[1],
        args: positional.slice(2),
        flags,
    };
}
export async function dispatchCli(rawArgs) {
    const parsed = parseCliArgs(rawArgs);
    const ws = parsed.flags.workspace || findWorkspaceRoot();
    if (parsed.flags.version || parsed.command === "version") {
        if (parsed.flags.json) {
            console.log(JSON.stringify({ version: "1.0.0", name: "ai-dlc-mcp" }, null, 2));
        }
        else {
            console.log("ai-dlc-mcp v1.0.0");
        }
        return true;
    }
    if (parsed.flags.help || parsed.command === "help" || !parsed.command) {
        printHelp();
        return true;
    }
    switch (parsed.command) {
        case "doctor": {
            const report = await runDlcDoctor(ws);
            if (parsed.flags.json) {
                console.log(JSON.stringify(report, null, 2));
            }
            else {
                const icon = report.overallStatus === "healthy" ? "✅" : "⚠️";
                console.log(`${icon} AI-DLC Doctor Diagnostic Report`);
                console.log(`* Overall Status: ${report.overallStatus.toUpperCase()}`);
                console.log(`* Workspace: ${report.workspaceDir}`);
                console.log(`* Active Space: ${report.activeSpace}\n`);
                for (const c of report.checks) {
                    const cIcon = c.status === "pass" ? "✔" : c.status === "warn" ? "⚠" : "✖";
                    console.log(`  ${cIcon} ${c.name}: ${c.message}`);
                }
            }
            return true;
        }
        case "status":
        case "now": {
            const state = await loadActiveIntentState(ws);
            if (parsed.flags.json) {
                console.log(JSON.stringify(state || { active: null }, null, 2));
            }
            else {
                if (!state) {
                    console.log("No active AI-DLC intent found. Initialize one with: aidlc intent init <label>");
                }
                else {
                    const currentStage = state.stages[state.currentStageIndex];
                    console.log(`Active Intent: ${state.label} (${state.intentId})`);
                    console.log(`Scope: ${state.profile} | Depth: ${state.depth} | Testing: ${state.testStrategy}`);
                    console.log(`Status: ${state.status.toUpperCase()}`);
                    if (currentStage) {
                        console.log(`Current Stage: ${currentStage.number} ${currentStage.name} [${currentStage.status}]`);
                        if (currentStage.unresolvedProbes && currentStage.unresolvedProbes.length > 0) {
                            console.log("\nUnresolved Socratic Probes:");
                            for (const p of currentStage.unresolvedProbes) {
                                console.log(`  - ${p}`);
                            }
                        }
                    }
                }
            }
            return true;
        }
        case "intent": {
            const sub = parsed.subcommand;
            if (sub === "init") {
                const label = parsed.args[0] || "feature-intent";
                const desc = parsed.args.slice(1).join(" ") || `AI-DLC intent for ${label}`;
                const scope = (parsed.flags.scope || "feature");
                const depth = parsed.flags.depth;
                const testStrategy = parsed.flags.testStrategy;
                const res = await DlcStateMachine.initIntent({
                    label,
                    description: desc,
                    profile: scope,
                    depth,
                    testStrategy,
                    workspaceDir: ws,
                });
                if (parsed.flags.json) {
                    console.log(JSON.stringify(res.intent, null, 2));
                }
                else {
                    console.log(`✅ Initialized Intent '${label}' (${res.intent.intentId}) with scope '${scope}'`);
                    console.log(`Directory: ${res.intentDir}`);
                }
            }
            else if (sub === "switch") {
                const id = parsed.args[0];
                if (!id) {
                    console.error("Usage: aidlc intent switch <intentId>");
                    process.exit(1);
                }
                await setActiveIntent(id, ws);
                if (parsed.flags.json) {
                    console.log(JSON.stringify({ switched: id }, null, 2));
                }
                else {
                    console.log(`Switched active intent to: ${id}`);
                }
            }
            else {
                // intent list
                const intentIds = await listAllIntents(ws);
                const intents = [];
                for (const id of intentIds) {
                    try {
                        const it = await loadIntentState(id, ws);
                        if (it) {
                            intents.push(it);
                        }
                    }
                    catch { }
                }
                const activeState = await loadActiveIntentState(ws);
                if (parsed.flags.json) {
                    console.log(JSON.stringify(intents, null, 2));
                }
                else {
                    console.log(`Tracked Intents (${intents.length}):`);
                    for (const it of intents) {
                        const marker = activeState?.intentId === it.intentId ? "▶ " : "  ";
                        console.log(`${marker}${it.label} (${it.intentId}) - Scope: ${it.profile} [${it.status}]`);
                    }
                }
            }
            return true;
        }
        case "gate": {
            const sub = parsed.subcommand;
            if (sub === "approve") {
                const notes = parsed.flags.notes || parsed.args.join(" ") || "Approved by human user";
                const res = await DlcStateMachine.approveGate({ notes, workspaceDir: ws });
                if (parsed.flags.json) {
                    console.log(JSON.stringify(res, null, 2));
                }
                else {
                    console.log(`✅ Gate Approved for stage: ${res.previousStageId}`);
                    if (res.nextStageId) {
                        console.log(`Advanced to next stage: ${res.nextStageId}`);
                    }
                    else {
                        console.log("All lifecycle stages have cleared their approval gates!");
                    }
                }
            }
            else {
                console.error("Usage: aidlc gate approve [--notes <notes>]");
            }
            return true;
        }
        case "sensor": {
            const sub = parsed.subcommand;
            if (sub === "list") {
                const sensors = getAllSensorSpecs();
                if (parsed.flags.json) {
                    console.log(JSON.stringify(sensors, null, 2));
                }
                else {
                    console.log("Available AI-DLC Sensors (6):");
                    for (const s of sensors) {
                        console.log(`  - ${s.id} (${s.category}, severity: ${s.defaultSeverity}): ${s.description}`);
                    }
                }
            }
            else if (sub === "run") {
                const stageSlug = parsed.args[0] || "intent-capture";
                const filePath = parsed.flags.file || parsed.args[1];
                let content = "";
                if (filePath) {
                    const abs = path.isAbsolute(filePath) ? filePath : path.join(ws, filePath);
                    try {
                        content = fs.readFileSync(abs, "utf-8");
                    }
                    catch { }
                }
                else {
                    const state = await loadActiveIntentState(ws);
                    if (state) {
                        const currentStage = state.stages[state.currentStageIndex];
                        if (currentStage?.artifactPath) {
                            try {
                                content = fs.readFileSync(path.join(ws, currentStage.artifactPath), "utf-8");
                            }
                            catch { }
                        }
                    }
                }
                const report = await runStageSensors({
                    stageSlug,
                    content,
                    workspaceDir: ws,
                });
                if (parsed.flags.json) {
                    console.log(JSON.stringify(report, null, 2));
                }
                else {
                    const icon = report.overallPass ? "✅" : "⚠️";
                    console.log(`${icon} Sensor Validation Report: ${stageSlug}`);
                    console.log(`Overall Status: ${report.overallPass ? "PASSED" : "FINDINGS DETECTED"}\n`);
                    for (const r of report.results) {
                        const rIcon = r.pass ? "✔" : "✖";
                        console.log(`  ${rIcon} ${r.sensorId} (${r.severity})`);
                        for (const f of r.findings) {
                            console.log(`     ⚠ ${f}`);
                        }
                    }
                }
                if (!report.overallPass) {
                    process.exitCode = 1;
                }
            }
            else {
                console.error("Usage: aidlc sensor run <stageSlug> [--file <path>] | aidlc sensor list");
            }
            return true;
        }
        case "runtime":
        case "cost": {
            try {
                const report = await computeSessionCost(parsed.flags.intent, ws);
                if (parsed.flags.json) {
                    console.log(JSON.stringify(report, null, 2));
                }
                else {
                    console.log(`Session Cost Report: ${report.workflow_id}`);
                    console.log(`Scope: ${report.scope} | Duration: ${report.duration_minutes !== null ? `${report.duration_minutes} min` : "in progress"}`);
                    console.log(`Stages: ${report.stages.approved}/${report.stages.total} approved (${report.stages.pending} pending)`);
                    console.log(`Memory: ${report.memory.total} entries | Sensors Fired: ${report.sensors.total} (${report.sensors.passed} passed)`);
                    console.log(`Learnings Captured: ${report.learnings.from_orchestrator + report.learnings.from_user_addition}`);
                }
            }
            catch (err) {
                if (parsed.flags.json) {
                    console.log(JSON.stringify({ error: err.message, status: "no_session" }));
                }
                else {
                    console.error(`No session data yet: ${err.message}`);
                }
                process.exitCode = 1;
            }
            return true;
        }
        case "replay": {
            try {
                const replay = await generateSessionReplay(parsed.flags.intent, ws);
                console.log(replay);
            }
            catch (err) {
                console.error(`Unable to generate replay: ${err.message}`);
                process.exitCode = 1;
            }
            return true;
        }
        case "outcomes": {
            try {
                const { content, filePath } = await generateOutcomesPack({
                    intentId: parsed.flags.intent,
                    workspaceDir: ws,
                    writeToFile: parsed.flags.write,
                });
                if (parsed.flags.json) {
                    console.log(JSON.stringify({ filePath, length: content.length }, null, 2));
                }
                else {
                    if (filePath) {
                        console.log(`✅ Handover Pack written to: ${filePath}`);
                    }
                    else {
                        console.log(content);
                    }
                }
            }
            catch (err) {
                if (parsed.flags.json) {
                    console.log(JSON.stringify({ error: err.message }));
                }
                else {
                    console.error(`Unable to generate outcomes pack: ${err.message}`);
                }
                process.exitCode = 1;
            }
            return true;
        }
        case "memory": {
            const sub = parsed.subcommand;
            if (sub === "learn") {
                const text = parsed.args.join(" ");
                if (!text) {
                    console.error("Usage: aidlc memory learn <learning text>");
                    process.exit(1);
                }
                await recordLearning({ learning: text, workspaceDir: ws });
                if (parsed.flags.json) {
                    console.log(JSON.stringify({ recorded: text }, null, 2));
                }
                else {
                    console.log(`✅ Learning recorded to learnings.md`);
                }
            }
            else if (sub === "update") {
                const layer = (parsed.args[0] || "team");
                const heading = parsed.args[1];
                const ruleText = parsed.args.slice(2).join(" ");
                if (!heading || !ruleText) {
                    console.error("Usage: aidlc memory update <layer> <heading> <ruleText>");
                    process.exit(1);
                }
                await updateMemoryRule(layer, heading, ruleText, ws);
                if (parsed.flags.json) {
                    console.log(JSON.stringify({ updated: layer, heading }, null, 2));
                }
                else {
                    console.log(`✅ Rule updated in ${layer}.md under ## ${heading}`);
                }
            }
            else {
                // memory get
                const layer = parsed.args[0];
                if (layer) {
                    const content = await readMemoryLayer(layer, ws);
                    console.log(content);
                }
                else {
                    const comp = await resolveActiveMemory({ workspaceDir: ws });
                    if (parsed.flags.json) {
                        console.log(JSON.stringify(comp, null, 2));
                    }
                    else {
                        console.log(comp.combinedText);
                    }
                }
            }
            return true;
        }
        case "hook": {
            const event = (parsed.subcommand || "statusline");
            const result = await executeHook({ event, workspaceDir: ws });
            if (parsed.flags.json) {
                console.log(JSON.stringify(result, null, 2));
            }
            else {
                if (result.contextPayload) {
                    console.log(result.contextPayload);
                }
                else if (result.message) {
                    console.log(result.message);
                }
            }
            if (result.action === "block") {
                process.exitCode = 2;
            }
            return true;
        }
        case "install-hooks": {
            const target = (parsed.subcommand || parsed.flags.target || "all");
            const res = await installHooks({ target, workspaceDir: ws });
            if (parsed.flags.json) {
                console.log(JSON.stringify(res, null, 2));
            }
            else {
                console.log(`Installed hooks: ${res.installed.join(", ") || "None"}`);
                if (res.skipped.length > 0) {
                    console.log(`Skipped: ${res.skipped.join(", ")}`);
                }
            }
            return true;
        }
        case "extensions":
        case "flows": {
            const cache = loadAllExtensions(ws);
            if (parsed.flags.json) {
                console.log(JSON.stringify(cache, null, 2));
            }
            else {
                console.log(`🧩 Active Extension Packs: ${cache.packs.length}`);
                for (const p of cache.packs) {
                    console.log(`  📦 ${p.manifest?.name || path.basename(p.sourcePath)} (${p.tier})`);
                    console.log(`     Path: ${p.sourcePath}`);
                    console.log(`     Scopes: ${Object.keys(p.scopes).join(", ") || "None"}`);
                    console.log(`     Stages: ${Object.keys(p.stages).join(", ") || "None"}`);
                    console.log(`     Knowledge Docs: ${p.knowledge.length}`);
                }
                if (cache.packs.length === 0) {
                    console.log("No custom extension packs loaded. Standard built-in lifecycle is active.");
                    console.log("To load custom flows, set AIDLC_FLOWS_DIR=/path/to/repo or create ./.aidlc/ in the workspace.");
                }
            }
            return true;
        }
        default:
            console.error(`Unknown command: ${parsed.command}. Run 'aidlc --help' for usage.`);
            process.exitCode = 1;
            return true;
    }
}
function printHelp() {
    console.log(`AI-DLC CLI & MCP Server (ai-dlc-mcp)

Usage:
  aidlc [command] [options]
  npx aidlc [command] [options]

Commands:
  doctor                       Run environment and workspace health diagnostics
  status, now                  View active intent status, current stage, and gate
  intent [list|init|switch]    Manage AI-DLC lifecycle intents
  gate approve [--notes <n>]   Approve stage gate and advance state machine
  sensor [run|list]            Execute deterministic verification sensors
  runtime summary, cost        View deterministic duration, stage rollups & metrics
  replay                       Print structured session narrative replay
  outcomes [--write]           Generate OUTCOMES.md handover pack
  memory [get|update|learn]    Inspect and update 3-tier memory rules and learnings
  hook [event]                 Execute client lifecycle hook (session-start, stop, etc.)
  install-hooks [target]       Install hooks into Claude Code, Cursor, or Git

Options:
  --json                       Output machine-readable JSON (ideal for AI agents)
  --workspace <path>           Explicit workspace root (defaults to auto-discovery)
  --space <name>               Target space (defaults to 'default')
  --scope <scope>              Lifecycle scope (feature, mvp, poc, bugfix, etc.)
  --write, -w                  Write generated reports (e.g. OUTCOMES.md) to disk
  --help, -h                   Show this help message
  --version, -v                Print server version

When run without arguments or with --mcp:
  Launches the Model Context Protocol (MCP) server over Stdio transport.
`);
}
//# sourceMappingURL=dispatcher.js.map