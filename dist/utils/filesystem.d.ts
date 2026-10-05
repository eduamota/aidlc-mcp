import { IntentState } from "../types.js";
/**
 * Generates an intent ID following the YYMMDD-<label> format.
 */
export declare function generateIntentId(label: string): string;
/**
 * Gets the directory for a specific intent.
 */
export declare function getIntentDirPath(intentId: string, workspaceDir?: string): string;
/**
 * Formats IntentState into canonical markdown for aidlc-state.md.
 */
export declare function formatAidlcStateMarkdown(state: IntentState): string;
/**
 * Scaffolds an intent folder and initial state files.
 */
export declare function scaffoldIntent(state: IntentState, workspaceDir?: string): Promise<string>;
/**
 * Saves updated IntentState back to disk.
 */
export declare function persistIntentState(state: IntentState, workspaceDir?: string): Promise<void>;
/**
 * Loads IntentState for a specific intent ID.
 */
export declare function loadIntentState(intentId: string, workspaceDir?: string): Promise<IntentState | null>;
/**
 * Sets the active intent ID.
 */
export declare function setActiveIntent(intentId: string, workspaceDir?: string): Promise<void>;
/**
 * Gets the active intent ID.
 */
export declare function getActiveIntentId(workspaceDir?: string): Promise<string | null>;
/**
 * Loads the currently active IntentState.
 */
export declare function loadActiveIntentState(workspaceDir?: string): Promise<IntentState | null>;
/**
 * Lists all existing intents in the workspace.
 */
export declare function listAllIntents(workspaceDir?: string): Promise<string[]>;
/**
 * Saves a stage artifact file inside the intent directory.
 */
export declare function saveStageArtifact(intentId: string, phase: string, artifactName: string, content: string, workspaceDir?: string): Promise<string>;
