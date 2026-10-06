/**
 * Official AI-DLC Scope Specifications generated from awslabs/aidlc-workflows/core/scopes/
 * Total scopes: 11
 */
import { ScopeType, DepthLevel, TestStrategy } from "../types.js";
export interface ScopeSpec {
    name: ScopeType;
    depth: DepthLevel;
    testStrategy: TestStrategy;
    keywords: string[];
    description: string;
    skeleton: "on" | "off";
    existingCode?: boolean;
    runner?: boolean;
    reviewCap?: "none" | "advisory" | "strict";
    guardPolicy: "off" | "strict" | "relaxed";
    sensors: "on" | "off";
    learnings: "on" | "off";
    summaryConfirmation: "on" | "off";
    planApproval: "on" | "off";
    collaborators: "on" | "off";
    markdown: string;
}
export declare const SCOPE_SPECS: Record<ScopeType, ScopeSpec>;
export declare function getScopeSpec(scopeName: string): ScopeSpec | undefined;
export declare function getAllScopeSpecs(): ScopeSpec[];
/**
 * Detects an appropriate scope from human prompt text based on official keyword triggers.
 */
export declare function detectScopeFromPrompt(text: string): ScopeType | undefined;
