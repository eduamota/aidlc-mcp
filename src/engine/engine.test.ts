import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DlcStateMachine } from "./state-machine.js";
import { evaluateRubric } from "./socratic-rubric.js";
import { SCOPES, createStagesForScope } from "./profiles.js";
import { runDlcDoctor } from "../utils/doctor.js";
import { addKnowledgeDocument, listKnowledgeDocuments, readKnowledgeDocument } from "../utils/knowledge.js";

test("Socratic Rubric Evaluation", () => {
  // 1. Incomplete draft
  const poorContent = "We want an inventory API with GET and POST.";
  const eval1 = evaluateRubric("intent-capture", poorContent);
  assert.equal(eval1.satisfied, false, "Poor draft should not satisfy rubric");
  assert.ok(eval1.unresolvedProbes.length > 0, "Should contain unresolved probes");

  // 2. Comprehensive draft covering all dimensions
  const richContent = `
# Intent Brief: Inventory Management API

## Problem Statement & Motivation
Users currently suffer from stale stock counts across distributed warehouses.
Without this real-time inventory system, over-selling occurs daily causing churn.

## Scope Boundaries & Non-Goals
- In scope: Product inventory tracking, real-time stock deductions, warehouse locations.
- Out of scope & Non-goals: Payment processing, shopping cart UI, external billing integrations.

## Measurable Success Criteria
- Acceptance metric: < 50ms latency on inventory check queries.
- Zero over-allocation under 500 concurrent stock reservation requests.
  `;

  const eval2 = evaluateRubric("intent-capture", richContent);
  assert.equal(eval2.satisfied, true, "Rich draft should satisfy intent-capture rubric");
  assert.equal(eval2.unresolvedProbes.length, 0, "All probes should be resolved");
  assert.equal(eval2.score, 1.0);
});

test("The 11 AI-DLC Core Scopes and Stage Routing", () => {
  const scopeKeys = Object.keys(SCOPES);
  assert.equal(scopeKeys.length, 11, "Should support all 11 core scopes");

  // Verify enterprise has all stages
  assert.equal(SCOPES.enterprise.stageIds.length, 30);
  assert.equal(SCOPES.feature.stageIds.length, 30);
  assert.equal(SCOPES.poc.stageIds.length, 5);
  assert.equal(SCOPES.bugfix.stageIds.length, 6);
  assert.equal(SCOPES.express.stageIds.length, 7);

  // Verify greenfield vs brownfield stage mapping
  const greenStages = createStagesForScope("poc", "greenfield");
  assert.equal(greenStages.some((s) => s.id === "reverse-engineering"), false);

  const brownStages = createStagesForScope("poc", "brownfield");
  assert.equal(brownStages.some((s) => s.id === "reverse-engineering"), true);
});

test("AI-DLC Lifecycle State Machine Flow", async () => {
  const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-test-"));

  try {
    // 1. Initialize intent
    const { intent, intentDir } = await DlcStateMachine.initIntent({
      label: "test-auth-svc",
      description: "Build OAuth2 authorization service",
      profile: "express",
      workspaceDir: tempWs,
    });

    assert.equal(intent.profile, "express");
    assert.ok(intentDir.includes("test-auth-svc"));

    // Check files created
    const stateMd = await fs.readFile(path.join(intentDir, "aidlc-state.md"), "utf-8");
    assert.ok(stateMd.includes("AI-DLC State"));
    assert.ok(stateMd.includes("Requirements Analysis"));

    // 2. Check status
    const status1 = await DlcStateMachine.getStatus(undefined, tempWs);
    assert.equal(status1.intent?.intentId, intent.intentId);
    assert.equal(status1.activeStageState?.id, "requirements-analysis");

    // 3. Submit incomplete draft -> should fail gate approval
    const partialDraft = "# Requirements\nSimple user login";
    const subResult1 = await DlcStateMachine.submitDraft({
      content: partialDraft,
      workspaceDir: tempWs,
    });
    assert.equal(subResult1.evaluation.satisfied, false);

    await assert.rejects(
      async () => {
        await DlcStateMachine.approveGate({ workspaceDir: tempWs });
      },
      /has not met the Socratic rubric yet/,
      "Cannot approve gate before rubric is satisfied"
    );

    // 4. Submit complete draft -> satisfies rubric
    const completeDraft = `
# Requirements & User Stories: OAuth2 Service

## Functional Requirements
- As a client app, I want to exchange authorization codes for JWT tokens so that users authenticate.
- Endpoint POST /oauth/token accepts grant_type=authorization_code.
- Endpoint GET /oauth/userinfo returns user claims.

## Edge Cases and Limits
- Empty or invalid client credentials return 401 Unauthorized with standardized error JSON.
- Revoked tokens return immediate 403 Forbidden.
- Rate limits applied at 100 requests per minute per IP.

## Non-Functional Requirements (NFRs)
- Latency: P99 token verification under 10ms.
- High availability with stateless JWT signature validation.
    `;

    const subResult2 = await DlcStateMachine.submitDraft({
      content: completeDraft,
      workspaceDir: tempWs,
    });
    assert.equal(subResult2.evaluation.satisfied, true);

    // 5. Approve gate -> advances to stage 2
    const approveResult = await DlcStateMachine.approveGate({
      notes: "Requirements reviewed and approved by lead architect.",
      workspaceDir: tempWs,
    });
    assert.equal(approveResult.success, true);
    assert.equal(approveResult.nextStageId, "code-generation");

    // Check updated status
    const status2 = await DlcStateMachine.getStatus(undefined, tempWs);
    assert.equal(status2.activeStageState?.id, "code-generation");
  } finally {
    await fs.rm(tempWs, { recursive: true, force: true });
  }
});

test("Two-Tier Knowledge Base Management", async () => {
  const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-kb-"));

  try {
    // 1. Add team standard
    const doc = await addKnowledgeDocument({
      filename: "company-architecture-standards.md",
      content: "# Architecture Standards\nAll microservices must use gRPC for internal traffic and OpenTelemetry for traces.",
      category: "shared",
      workspaceDir: tempWs,
    });

    assert.equal(doc.filename, "company-architecture-standards.md");
    assert.equal(doc.category, "shared");

    // 2. List documents
    const list = await listKnowledgeDocuments(tempWs);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, "company-architecture-standards");

    // 3. Read document
    const read = await readKnowledgeDocument("company-architecture-standards", tempWs);
    assert.ok(read);
    assert.ok(read.content.includes("OpenTelemetry"));
  } finally {
    await fs.rm(tempWs, { recursive: true, force: true });
  }
});

test("AI-DLC Doctor Diagnostics", async () => {
  const report = await runDlcDoctor();
  assert.ok(report.checks.length >= 4);
  const nodeCheck = report.checks.find((c) => c.name === "Node.js Runtime");
  assert.ok(nodeCheck);
  assert.equal(nodeCheck.status, "pass");
});
