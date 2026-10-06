#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CONFIG } from "./config.js";
import { registerDlcTools } from "./mcp/tools.js";
import { registerDlcPrompts } from "./mcp/prompts.js";
import { registerDlcResources } from "./mcp/resources.js";
import { executeHook } from "./hooks/runner.js";
import { installHooks } from "./hooks/installer.js";
import { HookEvent } from "./types.js";

async function runCli(): Promise<boolean> {
  const args = process.argv.slice(2);
  if (args[0] === "hook") {
    const event = (args[1] || "statusline") as HookEvent;
    const result = await executeHook({ event });
    if (result.contextPayload) {
      console.log(result.contextPayload);
    } else if (result.message) {
      console.log(result.message);
    }
    process.exit(result.action === "block" ? 2 : 0);
  }

  if (args[0] === "install-hooks") {
    const target = (args[1] || "all") as any;
    const res = await installHooks({ target });
    console.log(`Installed hooks: ${res.installed.join(", ") || "None"}`);
    if (res.skipped.length > 0) {
      console.log(`Skipped: ${res.skipped.join(", ")}`);
    }
    process.exit(0);
  }

  return false;
}

async function main() {
  if (await runCli()) return;

  const server = new McpServer({
    name: CONFIG.SERVER_NAME,
    version: CONFIG.SERVER_VERSION,
  });

  // Register MCP capabilities
  registerDlcTools(server);
  registerDlcPrompts(server);
  registerDlcResources(server);

  // Connect to stdio transport
  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.error(`[${CONFIG.SERVER_NAME}] AI-DLC Socratic MCP Server running on stdio`);
}

main().catch((err) => {
  console.error(`[${CONFIG.SERVER_NAME}] Fatal server error:`, err);
  process.exit(1);
});
