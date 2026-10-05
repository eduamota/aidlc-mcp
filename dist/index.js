#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CONFIG } from "./config.js";
import { registerDlcTools } from "./mcp/tools.js";
import { registerDlcPrompts } from "./mcp/prompts.js";
import { registerDlcResources } from "./mcp/resources.js";
async function main() {
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
//# sourceMappingURL=index.js.map