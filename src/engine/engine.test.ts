import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DlcStateMachine } from "./state-machine.js";
import { evaluateRubric } from "./socratic-rubric.js";
import { PROFILES } from "./profiles.js";

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

test("AI-DLC Lifecycle State Machine Flow", async () => {
  // Use a temporary workspace folder for testing
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
    assert.equal(intent.stages.length, PROFILES.express.stageIds.length);
    assert.ok(intentDir.includes("test-auth-svc"));

    // Check files created
    const stateMd = await fs.readFile(path.join(intentDir, "aidlc-state.md"), "utf-8");
    assert.ok(stateMd.includes("AI-DLC State"));
    assert.ok(stateMd.includes("Requirements & User Stories"));

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

    // 5. Approve gate -> advances to stage 2 (code-generation in express)
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

test("Brownfield Reverse Engineering Injection & Evaluation", async () => {
  const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-brownfield-"));

  try {
    // 1. Initialize intent with brownfield projectType
    const { intent } = await DlcStateMachine.initIntent({
      label: "legacy-crm-upgrade",
      description: "Upgrade legacy CRM backend",
      profile: "feature",
      projectType: "brownfield",
      workspaceDir: tempWs,
    });

    // Verify reverse-engineering is injected before requirements-analysis
    const stageIds = intent.stages.map((s) => s.id);
    const revEngIdx = stageIds.indexOf("reverse-engineering");
    const reqIdx = stageIds.indexOf("requirements-analysis");

    assert.ok(revEngIdx !== -1, "reverse-engineering should be in stages");
    assert.ok(revEngIdx < reqIdx, "reverse-engineering should precede requirements-analysis");

    // 2. Evaluate documentary reverse engineering draft
    const docDraft = `
# Brownfield Reverse Engineering Documentation

## 1. System Overview & Tech Stack
- Runtime: Node.js 20 with TypeScript
- Package manager: npm, dependencies include express, pg, zod
- Framework: Express.js REST API

## 2. Component & Directory Layout
- ./src/controllers: Request handlers
- ./src/models: Database schemas and entities
- ./src/routes: HTTP route definitions
- Entry point: src/index.ts

## 3. Data Models & API Contracts
- Entities: User, Account, Contact, Deal
- API endpoints: /api/v1/accounts, /api/v1/contacts, /api/v1/deals

## 4. Conventions & Technical Constraints
- Legacy gotchas: Raw SQL queries in older services require backward-compatible schemas.
- Coding conventions: CamelCase properties, snake_case DB columns.
    `;

    const evalResult = evaluateRubric("reverse-engineering", docDraft);
    assert.equal(evalResult.satisfied, true, "Factual reverse engineering draft should satisfy rubric without debate");
    assert.equal(evalResult.unresolvedProbes.length, 0);
  } finally {
    await fs.rm(tempWs, { recursive: true, force: true });
  }
});

