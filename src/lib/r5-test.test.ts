import { describe, it, expect } from 'vitest';
import { R5Processor } from './r5-processor';
import { R5Validator } from './r5-validator';

describe('R5 Processor and Validator', () => {
  describe('R5 Processor', () => {
    const processor = new R5Processor();

    it('should process basic R5 Patient resource', () => {
      const patient: any = {
        resourceType: 'Patient',
        id: 'example-r5',
        active: true,
        name: [
          {
            use: 'official',
            family: 'R5Test',
            given: ['Patient']
          }
        ],
        meta: {
          versionId: '5.0.0',
          lastUpdated: '2023-01-01T00:00:00Z'
        }
      };

      const processed = processor.process(patient);
      expect(processed.resourceType).toBe('Patient');
      expect(processed.active).toBe(true);
      expect(processed.meta).toBeDefined();
      expect(processed.meta.versionId).toBe('5.0.0');
      expect(processed.name).toBeDefined();
      expect(Array.isArray(processed.name)).toBe(true);
    });

    it('should add meta information if missing in R5 resource', () => {
      const patient: any = {
        resourceType: 'Patient',
        name: [
          {
            use: 'official',
            family: 'R5Test'
          }
        ]
      };

      const processed = processor.process(patient);
      expect(processed.meta).toBeDefined();
      expect(processed.meta.versionId).toBe('1');
      expect(processed.meta.lastUpdated).toBeDefined();
    });

    it('should normalize R5 extensions', () => {
      const resource: any = {
        resourceType: 'Patient',
        extension: {
          url: 'http://hl7.org/fhir/StructureDefinition/patient-birthPlace',
          valueAddress: {
            city: 'TestCity'
          }
        }
      };

      const processed = processor.process(resource);
      expect(Array.isArray(processed.extension)).toBe(true);
      expect(processed.extension[0].url).toBe('http://hl7.org/fhir/StructureDefinition/patient-birthPlace');
    });
  });

  describe('R5 Validator', () => {
    const validator = new R5Validator();

    it('should validate valid R5 Patient resource', () => {
      const patient: any = {
        resourceType: 'Patient',
        id: 'r5-patient-example',
        active: true,
        name: [
          {
            use: 'official',
            family: 'R5Test',
            given: ['Validation']
          }
        ],
        gender: 'male',
        birthDate: '1980-01-01',
        meta: {
          versionId: '5.0.1'
        }
      };

      const result = validator.validate(patient);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.version).toBe('R5');
    });

    it('should validate valid R5 MedicationRequest resource', () => {
      const medicationRequest: any = {
        resourceType: 'MedicationRequest',
        id: 'r5-medreq-example',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '322236009',
              display: 'Paracetamol 500mg tablets'
            }
          ]
        },
        subject: {
          reference: 'Patient/r5-patient-example'
        },
        authoredOn: '2023-01-01T00:00:00Z',
        fhirVersion: '5.0.0'
      };

      const result = validator.validate(medicationRequest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.version).toBe('R5');
    });

    it('should detect R5 version correctly', () => {
      const resource: any = {
        resourceType: 'Patient',
        fhirVersion: '5.0.1',
        meta: {
          versionId: '5.0.1'
        }
      };

      const version = validator.detectVersion(resource);
      expect(version).toBe('R5');
    });

    it('should detect R5 version from meta information', () => {
      const resource: any = {
        resourceType: 'Observation',
        meta: {
          versionId: '5.0.0'
        }
      };

      const version = validator.detectVersion(resource);
      expect(version).toBe('R5');
    });

    it('should reject invalid R5 resource with missing required fields', () => {
      const invalidResource: any = {
        resourceType: 'Patient'
        // Missing required fields like name or identifier
      };

      const result = validator.validate(invalidResource);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('R5 Patient should have at least one name or identifier');
    });
  });

  describe('R5 Integration Test', () => {
    it('should validate then process R5 resources consistently', () => {
      const validator = new R5Validator();
      const processor = new R5Processor();

      const medicationRequest: any = {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '322236009',
              display: 'Paracetamol'
            }
          ]
        },
        subject: {
          reference: 'Patient/r5-patient-example'
        },
        fhirVersion: '5.0.0'
      };

      // Validate first
      const validationResult = validator.validate(medicationRequest);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.version).toBe('R5');

      // Then process
      const processed = processor.process(medicationRequest);
      expect(processed.resourceType).toBe('MedicationRequest');
      expect(processed.status).toBe('active');
      expect(processed.meta).toBeDefined();
      expect(processed.fhirVersion).toBe('5.0.0');
    });

    it('should handle R5 Observation resources', () => {
      const validator = new R5Validator();
      const processor = new R5Processor();

      const observation: any = {
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8302-2',
              display: 'Body height'
            }
          ]
        },
        subject: {
          reference: 'Patient/r5-patient-example'
        },
        effectiveDateTime: '2023-01-01T10:00:00Z',
        valueQuantity: {
          value: 175,
          unit: 'cm',
          system: 'http://unitsofmeasure.org',
          code: 'cm'
        },
        fhirVersion: '5.0.0'
      };

      // Validate
      const validationResult = validator.validate(observation);
      expect(validationResult.valid).toBe(true);

      // Process
      const processed = processor.process(observation);
      expect(processed.resourceType).toBe('Observation');
      expect(processed.valueQuantity.value).toBe(175);
      expect(processed.meta).toBeDefined();
    });
  });
});