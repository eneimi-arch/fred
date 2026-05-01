import type fhir from 'fhir/r4';

export type FhirResource = fhir.Resource;
export type FhirPatient = fhir.Patient;
export type FhirObservation = fhir.Observation;
export type FhirMedicationRequest = fhir.MedicationRequest;
export type FhirBundle = fhir.Bundle;
export type FhirBundleEntry = fhir.BundleEntry;

export interface ProfileEntry {
  index: number;
  path: string;
  min: number;
  max: string;
  type?: Array<{ code: string; profile?: string; targetProfile?: string; aggregation?: string[] }>;
  name?: string;
  short?: string;
  binding?: {
    strength: string;
    reference: string;
  };
  nameReference?: string;
  refSchema?: string;
  isSummary?: boolean;
  isModifier?: boolean;
  [key: string]: any;
}

export interface FhirProfileSchema {
  [path: string]: ProfileEntry;
}

export interface FhirValuesets {
  [url: string]: {
    type: 'complete' | 'fragment';
    items: Array<[string, string]>;
  };
}

export interface SimplifiedProfiles {
  profiles: {
    [resourceType: string]: FhirProfileSchema;
  };
  valuesets: FhirValuesets;
}

export interface DecoratedNode {
  id: number;
  index: number;
  name: string;
  displayName: string;
  schemaPath: string;
  fhirType?: string;
  level: number;
  short?: string;
  isRequired?: boolean;
  binding?: { strength: string; reference: string };
  range?: [number | string, number | string];
  nodeType: 'value' | 'object' | 'valueArray' | 'objectArray' | 'arrayObject';
  value?: any;
  children?: DecoratedNode[];
  contentType?: string;
  hidden?: boolean;
  ui?: {
    status: string;
    validationErr?: string;
    prevState?: any;
    menu?: any;
    count?: number;
    update?: any;
  };
  nodeCreator?: string;
}
