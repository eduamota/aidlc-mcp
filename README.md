# AI-DLC Socratic MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that implements the **AI-Driven Life Cycle (AI-DLC)** methodology (inspired by [AWS AI-DLC](https://github.com/awslabs/aidlc-workflows)) with an embedded **Socratic Elicitation & Review Engine**.

It enforces disciplined, verifiable software delivery for AI coding assistants (Claude Code, Cursor, Codex CLI, Antigravity, Kiro) through guided inquiry, stage-specific rubrics, and explicit approval gates.

---

## 🌟 Key Features

1. **Full Lifecycle Steering**: 
   - *Initialization* $\rightarrow$ *Ideation* $\rightarrow$ *Inception* $\rightarrow$ *Construction* $\rightarrow$ *Verification* $\rightarrow$ *Operation*.
2. **Adaptive Workflow Profiles**:
   - `feature`: All 6 phases and complete verification.
   - `mvp`: Fast greenfield prototype flow.
   - `bugfix`: Root cause analysis and surgical regression fix.
   - `express`: Lightweight rapid change flow.
3. **Embedded Socratic Rubric Engine**:
   - Evaluates drafted artifacts against stage-specific probing criteria (edge cases, non-goals, failure modes, blast radiuses, trade-offs).
   - Generates lingering Socratic inquiries until the rubric is satisfied.
4. **Approval Gate Enforcement**:
   - *"You decide, AI executes."* Stages cannot transition until criteria are met and the human explicitly approves.
5. **Traceable Local State**:
   - Stores versioned artifacts and canonical `aidlc-state.md` under `./aidlc/spaces/default/intents/<YYMMDD>-<label>/`.

---

## 🚀 Quick Start

### 1. Build the Server
```bash
git clone <repo-url> ai-dlc-mcp
cd ai-dlc-mcp
npm install
npm run build
```

### 2. Configure Your AI Client

#### Claude Code / Claude Desktop
Add to your `claude_desktop_config.json` or `.claude/config.json`:
```json
{
  "mcpServers": {
    "aidlc": {
      "command": "node",
      "args": ["/absolute/path/to/ai-dlc-mcp/dist/index.js"]
    }
  }
}
```

#### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "aidlc": {
      "command": "node",
      "args": ["/absolute/path/to/ai-dlc-mcp/dist/index.js"]
    }
  }
}
```

---

## 🛠️ MCP Primitives

### Tools
| Tool | Description |
|---|---|
| `dlc_init_intent` | Initialize a new intent with profile (`feature`, `mvp`, `bugfix`, `express`) and scaffold files. |
| `dlc_get_status` | Retrieve active intent progress, current stage, gate status, and unresolved Socratic probes. |
| `dlc_check_rubric` | Pre-flight test draft content against a stage's Socratic rubric without saving to disk. |
| `dlc_submit_draft` | Save stage artifact markdown and evaluate rubric satisfaction. |
| `dlc_approve_gate` | Confirm human sign-off and advance the state machine to the next stage. |
| `dlc_list_intents` | List all tracked intents in the workspace. |

### Prompts
| Prompt | Description |
|---|---|
| `aidlc_start` | Orchestrates workflow kickoff, profile selection, and intent initialization. |
| `socratic_stage_inquiry` | Injects the Socratic inquiry protocol and rubric dimensions for any stage. |
| `persona_product_agent` | Socratic Product Strategist (intent, empathy, boundaries, NFRs). |
| `persona_architect_agent` | Socratic Systems Architect (trade-offs, failure modes, invariants, schemas). |
| `persona_security_agent` | Staff Security Specialist (threat model, attack surface, secret hygiene). |
| `persona_qa_agent` | Lead QA Engineer (edge cases, mutation/property testing, test evidence). |
| `persona_devops_agent` | SRE & Operations Lead (rollback plan, observability, post-mortem reflection). |

### Resources
| URI | Description |
|---|---|
| `aidlc://state` | Live content of `./aidlc/.../aidlc-state.md`. |
| `aidlc://active-intent` | JSON metadata of active intent. |
| `aidlc://rubrics` | Complete catalog of Socratic rubrics and probing dimensions. |

---

## 🔄 The Socratic Workflow Loop

```
User Intent
   │
   ▼
dlc_init_intent ({ label: "auth-service", profile: "feature" })
   │
   ▼
Adopt Persona & Socratic Inquiry (Ask trade-offs, limits, non-goals)
   │
   ▼
dlc_submit_draft ({ stageId: "intent-capture", content: "..." })
   │
   ├── [Rubric Incomplete] ──► Returns lingering Socratic questions ──┐
   │                                                                 │
   │                                                                 ▼
   │                              Agent probes user on missing dimensions
   │                                                                 │
   └── [Rubric Satisfied] ◄──────────────────────────────────────────┘
           │
           ▼
dlc_approve_gate ({ notes: "Approved by tech lead" })
           │
           ▼
Advances to Stage 2.1 (Requirements & User Stories)
```

---

## 🧪 Testing

Run automated tests:
```bash
npm test
```

## 📄 License
MIT
