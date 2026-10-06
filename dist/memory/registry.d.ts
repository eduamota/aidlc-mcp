/**
 * Official AI-DLC Memory Defaults generated from awslabs/aidlc-workflows/core/memory/
 * Total memory templates: 14
 */
export declare const MEMORY_DEFAULTS: Record<string, string>;
/**
 * Retrieve a default memory template by key (e.g. 'org', 'team', 'project', 'phases/inception').
 */
export declare function getMemoryDefault(key: string): string | undefined;
/**
 * Get all default memory templates.
 */
export declare function getAllMemoryDefaults(): Record<string, string>;
