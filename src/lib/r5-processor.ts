import type { FhirResource } from '../types/fhir.d';

/**
 * R5 FHIR Processor
 * Handles R5-specific processing of FHIR resources in TypeScript
 */
export class R5Processor {
  /**
   * Process an R5 FHIR resource
   * @param resource - The FHIR resource to process
   * @returns Processed resource with meta information and normalized structure
   */
  process(resource: any): any {
    if (!resource?.resourceType) {
      throw new Error('Invalid resource: missing resourceType');
    }

    // Clone the resource to avoid mutating the original
    const processed: any = JSON.parse(JSON.stringify(resource));

    // Add meta information if missing
    this.ensureMeta(processed);

    // Normalize extensions
    this.normalizeExtensions(processed);

    // R5-specific processing
    this.processR5Resource(processed);

    return processed;
  }

  /**
   * Ensure meta information exists
   * @param resource - The resource to add meta information to
   */
  private ensureMeta(resource: FhirResource): void {
    if (!resource.meta) {
      resource.meta = {
        versionId: '1',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Normalize R5 extensions to ensure they're always arrays
   * @param resource - The resource to normalize
   */
  private normalizeExtensions(resource: FhirResource): void {
    if (resource.extension) {
      if (!Array.isArray(resource.extension)) {
        resource.extension = [resource.extension];
      }
    }
  }

  /**
   * R5-specific resource processing
   * @param resource - The resource to process
   */
  private processR5Resource(resource: FhirResource): void {
    // R5-specific processing can be added here
    // For now, use similar processing as R4 since the structure is compatible
    switch (resource.resourceType) {
      case 'Patient':
        this.processPatient(resource);
        break;
      case 'MedicationRequest':
        this.processMedicationRequest(resource);
        break;
      case 'Observation':
        this.processObservation(resource);
        break;
      // Add more R5-specific resource types as needed
    }
  }

  /**
   * Patient-specific processing for R5
   * @param patient - The patient resource to process
   */
  private processPatient(patient: any): void {
    // Ensure name is an array if it exists
    if (patient.name && !Array.isArray(patient.name)) {
      patient.name = [patient.name];
    }

    // R5 may have additional patient fields to process
  }

  /**
   * MedicationRequest-specific processing for R5
   * @param medicationRequest - The medication request to process
   */
  private processMedicationRequest(medicationRequest: any): void {
    // Ensure coding is an array if it exists
    if (medicationRequest.medicationCodeableConcept?.coding &&
        !Array.isArray(medicationRequest.medicationCodeableConcept.coding)) {
      medicationRequest.medicationCodeableConcept.coding = [medicationRequest.medicationCodeableConcept.coding];
    }

    // R5 may have additional medication request fields to process
  }

  /**
   * Observation-specific processing for R5
   * @param observation - The observation to process
   */
  private processObservation(observation: any): void {
    // Ensure coding is an array if it exists
    if (observation.code?.coding && !Array.isArray(observation.code.coding)) {
      observation.code.coding = [observation.code.coding];
    }

    // R5 may have additional observation fields to process
  }
}