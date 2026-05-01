import type { FhirResource, FhirPatient, FhirMedicationRequest, FhirObservation } from '../types/fhir.d';

/**
 * R4 FHIR Processor
 * Handles R4-specific processing of FHIR resources in TypeScript
 */
export class R4Processor {
  /**
   * Process an R4 FHIR resource
   * @param resource - The FHIR resource to process
   * @returns Processed resource with meta information and normalized structure
   */
  process(resource: FhirResource): FhirResource {
    if (!resource?.resourceType) {
      throw new Error('Invalid resource: missing resourceType');
    }

    // Clone the resource to avoid mutating the original
    const processed: FhirResource = JSON.parse(JSON.stringify(resource));

    // Add meta information if missing
    this.ensureMeta(processed);

    // Normalize extensions
    this.normalizeExtensions(processed);

    // R4-specific processing
    this.processR4Resource(processed);

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
   * Normalize R4 extensions to ensure they're always arrays
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
   * R4-specific resource processing
   * @param resource - The resource to process
   */
  private processR4Resource(resource: FhirResource): void {
    // Resource-specific processing
    switch (resource.resourceType) {
      case 'Patient':
        this.processPatient(resource as FhirPatient);
        break;
      case 'MedicationRequest':
        this.processMedicationRequest(resource as FhirMedicationRequest);
        break;
      case 'Observation':
        this.processObservation(resource as FhirObservation);
        break;
      // Add more resource types as needed
    }
  }

  /**
   * Patient-specific processing
   * @param patient - The patient resource to process
   */
  private processPatient(patient: FhirPatient): void {
    // Ensure name is an array if it exists
    if (patient.name && !Array.isArray(patient.name)) {
      patient.name = [patient.name];
    }
  }

  /**
   * MedicationRequest-specific processing
   * @param medicationRequest - The medication request to process
   */
  private processMedicationRequest(medicationRequest: FhirMedicationRequest): void {
    // Ensure coding is an array if it exists
    if (medicationRequest.medicationCodeableConcept?.coding &&
        !Array.isArray(medicationRequest.medicationCodeableConcept.coding)) {
      medicationRequest.medicationCodeableConcept.coding = [medicationRequest.medicationCodeableConcept.coding];
    }
  }

  /**
   * Observation-specific processing
   * @param observation - The observation to process
   */
  private processObservation(observation: FhirObservation): void {
    // Ensure coding is an array if it exists
    if (observation.code?.coding && !Array.isArray(observation.code.coding)) {
      observation.code.coding = [observation.code.coding];
    }
  }
}