/**
 * Official AI-DLC Sensor Specifications generated from awslabs/aidlc-workflows/core/sensors/
 * Total sensors: 6
 */
export interface SensorSpec {
    id: string;
    kind: string;
    command: string;
    defaultSeverity: "advisory" | "strict" | string;
    fireOn: "gate" | "code" | string;
    description: string;
    category: "document-provenance" | "document-shape" | "document-traceability" | "code-quality" | string;
    matches: string;
    timeoutSeconds: number;
    markdown: string;
}
export declare const SENSOR_SPECS: Record<string, SensorSpec>;
export declare function getSensorSpec(id: string): SensorSpec | undefined;
export declare function getAllSensorSpecs(): SensorSpec[];
