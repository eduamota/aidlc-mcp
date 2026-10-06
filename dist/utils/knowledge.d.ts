import { KnowledgeDocument } from "../types.js";
/**
 * Ensures knowledge directories exist for a space.
 */
export declare function ensureKnowledgeDirs(workspaceDir?: string, space?: string): Promise<string>;
/**
 * Adds or updates a knowledge document in the active space.
 */
export declare function addKnowledgeDocument(params: {
    filename: string;
    content: string;
    category?: "shared" | "agent" | "documentkb";
    agent?: string;
    workspaceDir?: string;
    space?: string;
}): Promise<KnowledgeDocument>;
/**
 * Lists all knowledge documents in the active space.
 */
export declare function listKnowledgeDocuments(workspaceDir?: string, space?: string): Promise<KnowledgeDocument[]>;
/**
 * Reads a knowledge document by relative path, filename, or ID.
 */
export declare function readKnowledgeDocument(identifier: string, workspaceDir?: string, space?: string): Promise<{
    filename: string;
    relativePath: string;
    content: string;
} | null>;
