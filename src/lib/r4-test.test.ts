import { describe, it, expect } from 'vitest';
import { R4Processor } from './r4-processor';
import { FhirValidator } from './fhir-validator';
import type { FhirResource } from '../types/fhir.d';

describe('Modern R4 Processor and Validator', () => {
  describe('R4 Processor', () => {
    const processor = new R4Processor();

    it('should process basic R4 Patient resource', () => {
      const patient: any = {
        resourceType: 'Patient',
        id: 'example',
        active: true,
        name: [
          {
            use: 'official',
            family: 'Example',
            given: ['Test']
          }
        ]
      };

      const processed = processor.process(patient);
      expect(processed.resourceType).toBe('Patient');
      expect(processed.active).toBe(true);
      expect(processed.meta).toBeDefined();
      expect(processed.meta?.versionId).toBe('1');
    });

    it('should add meta information if missing', () => {
      const patient: any = {
        resourceType: 'Patient',
        name: [
          {
            use: 'official',
            family: 'Example'
          }
        ]
      };

      const processed = processor.process(patient);
      expect(processed.meta).toBeDefined();
      expect(processed.meta?.versionId).toBe('1');
      expect(processed.meta?.lastUpdated).toBeDefined();
    });

    it('should normalize R4 extensions', () => {
      const resource: any = {
        resourceType: 'Patient',
        extension: {
          url: 'http://example.com/ext',
          valueString: 'test'
        }
      };

      const processed = processor.process(resource);
      expect(Array.isArray(processed.extension)).toBe(true);
      expect(processed.extension[0].url).toBe('http://example.com/ext');
    });
  });

  describe('FHIR Validator', () => {
    const validator = new FhirValidator();

    it('should validate valid R4 Patient resource', () => {
      const patient: any = {
        resourceType: 'Patient',
        id: 'example',
        active: true,
        name: [
          {
            use: 'official',
            family: 'Example',
            given: ['Test']
          }
        ],
        gender: 'male',
        birthDate: '1980-01-01'
      };

      const result = validator.validate(patient, 'R4');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid R4 MedicationRequest resource', () => {
      const medicationRequest: any = {
        resourceType: 'MedicationRequest',
        id: 'medreq-example',
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
          reference: 'Patient/example'
        },
        authoredOn: '2023-01-01T00:00:00Z',
        requester: {
          reference: 'Practitioner/example'
        }
      };

      const result = validator.validate(medicationRequest, 'R4');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect R4 version correctly', () => {
      const resource: any = {
        resourceType: 'Patient',
        fhirVersion: '4.0.1'
      };

      const version = validator.detectVersion(resource);
      expect(version).toBe('R4');
    });

    it('should reject invalid R4 resource with missing required fields', () => {
      const invalidResource: any = {
        resourceType: 'Patient'
        // Missing required fields
      };

      const result = validator.validate(invalidResource, 'R4');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Patient should have at least one name or identifier');
    });
  });

  describe('Integration Test', () => {
    it('should validate then process R4 resources consistently', () => {
      const validator = new FhirValidator();
      const processor = new R4Processor();

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
          reference: 'Patient/example'
        }
      };

      // Validate first
      const validationResult = validator.validate(medicationRequest, 'R4');
      expect(validationResult.valid).toBe(true);

      // Then process
      const processed = processor.process(medicationRequest);
      expect(processed.resourceType).toBe('MedicationRequest');
      expect(processed.status).toBe('active');
      expect(processed.meta).toBeDefined();
    });
  });
});