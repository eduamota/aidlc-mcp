export declare const CONFIG: {
    SERVER_NAME: string;
    SERVER_VERSION: string;
    DEFAULT_SPACE: string;
    BASE_DIR_REL: string;
    STATE_FILE: string;
    DESCRIPTION_FILE: string;
    ACTIVE_INTENT_FILE: string;
};
export declare function getWorkspaceDir(): string;
export declare function getSpaceDir(workspaceDir?: string, space?: string): string;
export declare function getIntentsDir(workspaceDir?: string, space?: string): string;
export declare function getKnowledgeDir(workspaceDir?: string, space?: string): string;
export declare function getKnowledgeDocumentsDir(workspaceDir?: string, space?: string): string;
export declare function getActiveIntentPointerPath(workspaceDir?: string): string;
