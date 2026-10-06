/**
 * Official AI-DLC Knowledge Base generated from awslabs/aidlc-workflows/core/knowledge/
 * Total core documents: 59
 */
export interface CoreKnowledgeDoc {
    id: string;
    title: string;
    filename: string;
    relativePath: string;
    category: "shared" | "agent";
    agent?: string;
    sizeBytes: number;
    preview: string;
    content: string;
}
export declare const CORE_KNOWLEDGE_LIST: CoreKnowledgeDoc[];
export declare const CORE_KNOWLEDGE_MAP: Record<string, CoreKnowledgeDoc>;
/**
 * Retrieve a core knowledge document by ID, relative path, or filename.
 */
export declare function getCoreKnowledgeDoc(identifier: string): CoreKnowledgeDoc | undefined;
/**
 * List all built-in core knowledge documents.
 */
export declare function getAllCoreKnowledgeDocs(): CoreKnowledgeDoc[];
