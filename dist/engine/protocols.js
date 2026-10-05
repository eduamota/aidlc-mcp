/**
 * Core AI-DLC Protocols based on awslabs/aidlc-workflows/core/aidlc-common/protocols/
 */
export const STAGE_PROTOCOL = `# AI-DLC Stage Protocol
Reference: awslabs/aidlc-workflows/core/aidlc-common/protocols/stage-protocol.md

## 1. The Person Drives
The person is in charge of their work, and AI-DLC enforces their will.
- Do what they explicitly ask, then say in one line what you did.
- Ask only when their intent is genuinely unclear, the way a colleague would.
- Never make them repeat themselves, retype an option, or confirm what they already said.
- The workflow's checks protect them from mistakes made on their behalf; they never stand between the person and what they asked for.

## 2. Voice Contract (How to Talk to the User)
MANDATORY on every stage, every gate, and every message the user reads:
- Narrate the work, NOT the plumbing. ("I'm working out which parts of the system fit this change" vs "The orchestration engine is resolving the compiled scope grid").
- Reserved internal vocabulary (DO NOT use in chat narration): engine, directive, dispatch, conductor, harness, scope grid, steering, mint intent, entropy, pipeline link.
- At gates, three plain things in order:
  1. What was produced.
  2. What the user should inspect (name files by path).
  3. What happens after they approve.

## 3. Approval Gate Rules (HARD STOP)
- When you present an approval gate question, you MUST end your turn immediately and wait for the user's explicit response.
- Do NOT call any tool until the user has typed their choice in a new message.
- An approval gate is a mandatory human checkpoint that cannot be inferred, auto-approved, or skipped.
- Standard 2-option choices:
  - Approve: Continue to [next stage]
  - Request Changes: Provide revision feedback
- If the user approves and asks for something ("looks fine but rename the handler"), record the approval, make the change, and report it in one line. No second gate.

## 4. Atomic Stage Ritual
Once a stage starts, every step in its protocol fires:
1. Socratic / Structured Questions (clarify requirements, non-goals, trade-offs)
2. Artifact Draft formulation (write versioned document to intent record)
3. Reviewer Verification (independent review pass against rubric)
4. Approval Gate (explicit human sign-off)
`;
export const REVIEWER_PROTOCOL = `# AI-DLC Reviewer Invocation Protocol (§12a)
Reference: awslabs/aidlc-workflows/core/aidlc-common/protocols/stage-protocol-reviewer.md

## 1. Role of the Reviewer
The reviewer agent (e.g. \`aidlc-architecture-reviewer-agent\`, \`aidlc-security-reviewer-agent\`, \`aidlc-code-reviewer-agent\`) performs an independent verification pass on drafted artifacts before human gate presentation.

## 2. Review Execution
- The reviewer inspects:
  1. The stage objective and rubric criteria.
  2. The drafted artifact markdown.
  3. Preceding baseline artifacts (e.g., verifying implementation plan matches architecture design).
- The reviewer issues a structured verdict:
  - **APPROVED**: Artifact meets all criteria, no blocking findings.
  - **REVISE**: Artifact has critical gaps or unaddressed edge cases; lists concrete remediation items.
  - **ADVISORY**: Approved with optional non-blocking recommendations.

## 3. Human Presentation
The reviewer findings are presented concisely at the approval gate so the human can review both the artifact and the independent audit before signing off.
`;
export const CONSTRUCTION_PROTOCOL = `# AI-DLC Construction & Implementation Protocol
Reference: awslabs/aidlc-workflows/core/aidlc-common/protocols/stage-protocol-construction.md

## 1. Units of Work (UoW) Execution
In Construction, tasks are decomposed into atomic, independent units of work arranged in a Directed Acyclic Graph (DAG).
- Build one unit at a time according to dependency order.
- Each unit must satisfy its interface contract before the next dependent unit begins.

## 2. Plan Approval Fence
- Before executing code generation, the tech lead's implementation plan must pass Plan Approval.
- The plan names affected files, interfaces, test strategies, and checkpoints.

## 3. Build & Test Failure Loopback
- If compiler errors, lint violations, or test assertion failures occur in Stage 3.6 (Build and Test):
  - Do NOT advance the gate.
  - Automatically loop back to Stage 3.5 (Code Generation) with the exact compiler/test diagnostic output.
  - Re-run Build and Test until all assertions pass.
`;
export const RECOVERY_PROTOCOL = `# AI-DLC Recovery & Session Resume Protocol
Reference: awslabs/aidlc-workflows/core/aidlc-common/protocols/stage-protocol-recovery.md

## 1. Session Resumption
When restarting an interrupted session or opening an existing workspace:
- Check \`aidlc://state\` or run \`dlc_get_status\`.
- Resume from the currently active stage recorded in \`aidlc-state.md\`.
- Do not repeat completed stages unless explicitly requested by the user.

## 2. Re-opening a Stage
If the user requests changes on an approved stage ("let's go back and redo the architecture"):
- Call \`dlc_reopen_stage({ stageId: "domain-design" })\`.
- The state machine reverts the stage status to \`in_progress\`.
- Existing files are preserved for revision rather than deleted.
`;
//# sourceMappingURL=protocols.js.map