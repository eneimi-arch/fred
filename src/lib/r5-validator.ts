import { FhirValidator } from './fhir-validator';
import type { FhirResource } from '../types/fhir.d';
import type { ValidationResult } from './fhir-validator';

/**
 * R5 FHIR Validator
 * Extends the base FHIR validator with R5-specific validation rules
 */
export class R5Validator extends FhirValidator {
  /**
   * Validate an R5 FHIR resource
   * @param resource - The FHIR resource to validate
   * @returns Validation result with R5-specific validation
   */
  validate(resource: any): ValidationResult {
    // Call base validation first
    const result = super.validate(resource, 'R5');

    // Add R5-specific validation
    this.validateR5Resource(resource, result);

    return result;
  }

  /**
   * R5-specific validation rules
   * @param resource - The resource to validate
   * @param result - The validation result to update
   */
  private validateR5Resource(resource: any, result: ValidationResult): void {
    // R5-specific validation can be added here
    // For now, R5 resources have similar structure to R4
    // but may have additional fields and constraints

    if (!resource?.resourceType) {
      return;
    }

    // Add R5-specific validation rules based on resource type
    switch (resource.resourceType) {
      case 'Patient':
        this.validateR5Patient(resource, result);
        break;
      case 'MedicationRequest':
        this.validateR5MedicationRequest(resource, result);
        break;
      case 'Observation':
        this.validateR5Observation(resource, result);
        break;
      // Add more R5-specific resource types as needed
    }
  }

  /**
   * R5-specific Patient validation
   * @param patient - The patient resource to validate
   * @param result - The validation result to update
   */
  private validateR5Patient(patient: any, result: ValidationResult): void {
    // R5 Patient resources have similar requirements to R4
    // but may have additional constraints
    if (!patient.name && !patient.identifier) {
      result.valid = false;
      result.errors.push('R5 Patient should have at least one name or identifier');
    }

    // R5 may have additional required fields
  }

  /**
   * R5-specific MedicationRequest validation
   * @param medicationRequest - The medication request to validate
   * @param result - The validation result to update
   */
  private validateR5MedicationRequest(medicationRequest: any, result: ValidationResult): void {
    // R5 MedicationRequest resources have similar requirements to R4
    if (!medicationRequest.status) {
      result.valid = false;
      result.errors.push('R5 MedicationRequest missing required field: status');
    }

    if (!medicationRequest.intent) {
      result.valid = false;
      result.errors.push('R5 MedicationRequest missing required field: intent');
    }

    // R5 may have additional required fields or different constraints
  }

  /**
   * R5-specific Observation validation
   * @param observation - The observation to validate
   * @param result - The validation result to update
   */
  private validateR5Observation(observation: any, result: ValidationResult): void {
    // R5 Observation resources have similar requirements to R4
    if (!observation.status) {
      result.valid = false;
      result.errors.push('R5 Observation missing required field: status');
    }

    if (!observation.code) {
      result.valid = false;
      result.errors.push('R5 Observation missing required field: code');
    }

    // R5 may have additional required fields or different constraints
  }

  /**
   * Detect R5 version from resource
   * @param resource - The resource to analyze
   * @returns 'R5' for R5 resources
   */
  detectVersion(resource: any): string {
    // Check for R5-specific indicators
    if (resource.fhirVersion?.startsWith('5.')) {
      return 'R5';
    }

    // Check meta information for R5 patterns
    if (resource.meta?.versionId?.startsWith('5')) {
      return 'R5';
    }

    // Default to base class detection
    return super.detectVersion(resource);
  }
}