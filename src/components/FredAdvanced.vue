<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// FHIR Versions and Profiles
const fhirVersions: { value: string, label: string, profiles: Record<string, any> }[] = [
  { value: 'R4', label: 'FHIR R4', profiles: {} },
  { value: 'R5', label: 'FHIR R5', profiles: {} },
  { value: 'STU3', label: 'FHIR STU3', profiles: {} },
  { value: 'DSTU2', label: 'FHIR DSTU2', profiles: {} }
];

// Main state
const currentFhirVersion = ref('R4');
const currentResourceType = ref('');
const currentResource = ref<any>({});
const jsonOutput = ref('{}');
const showOpenDialog = ref(false);
const showExportDialog = ref(false);
const showResourceSelector = ref(false);
const showElementSelector = ref(false);
const errorMessage = ref('');
const validationErrors = ref<string[]>([]);
const availableResourceTypes = ref<string[]>([]);
const resourceProfiles = ref<Record<string, any>>({});
const showVersionSelector = ref(false);
const selectedElements = ref<{name: string, path: string, value: any, type: string}[]>([]);
const availableElements = ref<{name: string, path: string, type: string, definition: string, binding: any}[]>([]);
const expandedPaths = ref<Record<string, boolean>>({});
const currentElementPath = ref('');

// ✅ STEP 2: NEW - Detect elements with ValueSet bindings
const hasValueSetBinding = computed(() => {
  return (elementPath: string) => {
    const element = availableElements.value.find(e => e.path === elementPath);
    return !!element?.binding && 
           ['required', 'extensible', 'preferred'].includes(element.binding.strength);
  };
});

// ✅ STEP 3 NEW: Get ValueSet options for bound elements
function getValueSetOptions(elementPath: string): {code: string, display: string}[] {
  const element = availableElements.value.find(e => e.path === elementPath);
  
  if (!element?.binding?.valueSet) {
    return [];
  }
  
  // Common FHIR ValueSets - fallback options if network fails
  const commonValueSets: Record<string, {code: string, display: string}[]> = {
    'http://hl7.org/fhir/ValueSet/administrative-gender': [
      { code: 'male', display: 'Male' },
      { code: 'female', display: 'Female' },
      { code: 'other', display: 'Other' },
      { code: 'unknown', display: 'Unknown' }
    ],
    'http://hl7.org/fhir/ValueSet/observation-status': [
      { code: 'registered', display: 'Registered' },
      { code: 'preliminary', display: 'Preliminary' },
      { code: 'final', display: 'Final' },
      { code: 'corrected', display: 'Corrected' },
      { code: 'cancelled', display: 'Cancelled' },
      { code: 'entered-in-error', display: 'Entered in Error' },
      { code: 'unknown', display: 'Unknown' }
    ],
    'http://hl7.org/fhir/ValueSet/contact-point-system': [
      { code: 'phone', display: 'Phone' },
      { code: 'fax', display: 'Fax' },
      { code: 'email', display: 'Email' },
      { code: 'pager', display: 'Pager' },
      { code: 'url', display: 'URL' },
      { code: 'sms', display: 'SMS' },
      { code: 'other', display: 'Other' }
    ],
    'http://hl7.org/fhir/ValueSet/name-use': [
      { code: 'usual', display: 'Usual' },
      { code: 'official', display: 'Official' },
      { code: 'temp', display: 'Temp' },
      { code: 'nickname', display: 'Nickname' },
      { code: 'anonymous', display: 'Anonymous' },
      { code: 'old', display: 'Old' },
      { code: 'maiden', display: 'Maiden' }
    ]
  };
  
  // Return cached options or empty array
  return commonValueSets[element.binding.valueSet] || [];
}

// Close all dropdowns when clicking outside
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.toolbar-group')) {
    showVersionSelector.value = false;
    showResourceSelector.value = false;
    showElementSelector.value = false;
  }
});

// Close other dropdowns when opening one
function openVersionSelector() {
  showVersionSelector.value = true;
  showResourceSelector.value = false;
  showElementSelector.value = false;
}

function openResourceSelector() {
  showResourceSelector.value = true;
  showVersionSelector.value = false;
  showElementSelector.value = false;
}

function openElementSelector() {
  currentElementPath.value = '';
  loadAvailableElements('');
  showElementSelector.value = true;
  showVersionSelector.value = false;
  showResourceSelector.value = false;
}

// Load FHIR profiles (lazy loading)
async function loadFhirProfiles() {
  try {
    // Load R4 profiles - these are Bundles containing StructureDefinitions
    const r4Resources: any = await import('../../fhir_profiles/R4/profiles-resources.json');
    const r4Types: any = await import('../../fhir_profiles/R4/profiles-types.json');

    // Combine all StructureDefinitions from both files
    const allStructureDefinitions: any[] = [];

    // Extract StructureDefinitions from resources bundle
    if (r4Resources.default?.entry) {
      allStructureDefinitions.push(...r4Resources.default.entry
        .map((e: any) => e.resource)
        .filter((r: any) => r.resourceType === 'StructureDefinition'));
    }

    // Extract StructureDefinitions from types bundle
    if (r4Types.default?.entry) {
      allStructureDefinitions.push(...r4Types.default.entry
        .map((e: any) => e.resource)
        .filter((r: any) => r.resourceType === 'StructureDefinition'));
    }

    // Create a map of resource types to their StructureDefinitions
    const resourceMap: Record<string, any> = {};
    allStructureDefinitions.forEach(sd => {
      const resourceType = sd.type || sd.url?.split('/').pop()?.split('|')[0];
      if (resourceType) {
        resourceMap[resourceType] = sd;
      }
    });

    fhirVersions[0].profiles = resourceMap;
    resourceProfiles.value.R4 = resourceMap;

    // Extract resource types (filter to canonical types only)
    const canonicalResourceTypes = [
      // Clinical Resources
      'Patient', 'RelatedPerson', 'Practitioner', 'PractitionerRole', 'Organization',
      'CareTeam', 'Group', 'Device', 'DeviceDefinition', 'DeviceMetric', 'DeviceRequest',
      'DeviceUseStatement', 'Substance', 'Specimen', 'SpecimenDefinition', 'Observation',
      'ObservationDefinition', 'DiagnosticReport', 'ImagingStudy', 'Media',
      'AdverseEvent', 'ClinicalImpression', 'DetectedIssue', 'RiskAssessment',
      'AllergyIntolerance', 'Condition', 'FamilyMemberHistory', 'Immunization',
      'ImmunizationEvaluation', 'ImmunizationRecommendation', 'Procedure',
      'MedicationRequest', 'Medication', 'MedicationAdministration',
      'MedicationDispense', 'MedicationKnowledge', 'MedicationStatement',
      'NutritionOrder', 'SupplyRequest', 'SupplyDelivery', 'Encounter', 'EpisodeOfCare',
      'Appointment', 'AppointmentResponse', 'Schedule', 'Slot', 'HealthcareService',
      'Location', 'OrganizationAffiliation', 'PaymentNotice', 'PaymentReconciliation',
      'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'Claim', 'ClaimResponse',
      'Coverage', 'ExplanationOfBenefit', 'Account', 'ChargeItem', 'ChargeItemDefinition',
      'Invoice', 'EnrollmentRequest', 'EnrollmentResponse', 'InsurancePlan',
      'Binary', 'Bundle', 'Composition', 'DocumentReference', 'DocumentManifest'
    ];

    availableResourceTypes.value = Object.keys(resourceMap)
      .filter(type => canonicalResourceTypes.includes(type))
      .sort();

  } catch (error) {
    console.error('Error loading FHIR profiles:', error);
    errorMessage.value = 'Error loading FHIR profiles: ' + error;
  }
}

// Initialize resource when type is selected
function initResource(resourceType: string) {
  currentResourceType.value = resourceType;
  currentResource.value = {
    resourceType: resourceType,
    id: 'new-' + resourceType.toLowerCase()
  };
  
  // Clear previous elements
  selectedElements.value = [];
  availableElements.value = [];
  expandedPaths.value = {};
  
  updateJson();
  loadAvailableElements();
}

// Load available elements for current resource type (lazy loading)
// ✅ STEP 1 COMPLETE: Now includes binding field
function loadAvailableElements(parentPath: string = '') {
  const profile = resourceProfiles.value[currentFhirVersion.value]?.[currentResourceType.value];
  if (!profile?.snapshot?.element) {
    availableElements.value = [];
    return;
  }

  // Get elements based on parent path
  const basePath = parentPath ? `${currentResourceType.value}.${parentPath}` : currentResourceType.value;
  const elements = profile.snapshot.element
    .filter((e: any) => {
      const pathParts = e.path.split('.');
      // For root level, get direct children
      if (!parentPath) {
        return pathParts.length === 2 && pathParts[0] === currentResourceType.value;
      }
      // For nested levels, get children of the parent path
      return e.path.startsWith(basePath + '.') && 
             pathParts.length === (basePath.split('.').length + 1);
    })
    .map((e: any) => {
      const pathParts = e.path.split('.');
      const elementPath = parentPath ? `${parentPath}.${pathParts[pathParts.length - 1]}` : pathParts[pathParts.length - 1];
      return {
        name: pathParts[pathParts.length - 1],
        path: elementPath,
        type: e.type?.[0]?.code || 'unknown',
        definition: e.definition || '',
        binding: e.binding || null  // ✅ STEP 1 FIX: Preserve binding data
      };
    })
    .sort((a: any, b: any) => {
      // Prioritize common fields
      const priority = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained', 'extension', 'modifierExtension'];
      const aPriority = priority.indexOf(a.name);
      const bPriority = priority.indexOf(b.name);
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

  availableElements.value = elements;
}

// Add element to resource (lazy loading implementation)
function addElement(elementPath: string, elementType: string) {
  // Set appropriate default value based on type
  let defaultValue: any;
  switch (elementType) {
    case 'string':
    case 'code':
    case 'uri':
    case 'url':
    case 'canonical':
      defaultValue = '';
      break;
    case 'boolean':
      defaultValue = false;
      break;
    case 'integer':
    case 'unsignedInt':
    case 'positiveInt':
      defaultValue = 0;
      break;
    case 'decimal':
      defaultValue = 0.0;
      break;
    case 'dateTime':
    case 'date':
    case 'instant':
      defaultValue = new Date().toISOString();
      break;
    case 'time':
      defaultValue = '12:00:00';
      break;
    default:
      defaultValue = {};
  }

  // Add to selected elements
  const elementName = elementPath.split('.').pop() || elementPath;
  selectedElements.value.push({
    name: elementName,
    path: elementPath,
    value: defaultValue,
    type: elementType
  });

  // Add to resource object (handle nested paths)
  setNestedValue(currentResource.value, elementPath, defaultValue);

  updateJson();
  showElementSelector.value = false;
}

// Remove element from resource
function removeElement(elementPath: string) {
  selectedElements.value = selectedElements.value.filter(e => e.path !== elementPath);
  // Remove from resource object (handle nested paths)
  removeNestedValue(currentResource.value, elementPath);
  updateJson();
}

// Update element value
function updateElementValue(elementPath: string, value: any) {
  const element = selectedElements.value.find(e => e.path === elementPath);
  if (element) {
    element.value = value;
    setNestedValue(currentResource.value, elementPath, value);
    updateJson();
  }
}

// Helper function to set nested value in object
function setNestedValue(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

// Helper function to remove nested value from object
function removeNestedValue(obj: any, path: string) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      return;
    }
    current = current[keys[i]];
  }
  
  delete current[keys[keys.length - 1]];
}

// Toggle expand/collapse for nested elements
function toggleExpand(path: string) {
  expandedPaths.value[path] = !expandedPaths.value[path];
}

// Check if path has nested elements
function hasNestedElements(path: string): boolean {
  const profile = resourceProfiles.value[currentFhirVersion.value]?.[currentResourceType.value];
  if (!profile?.snapshot?.element) return false;
  
  const fullPath = `${currentResourceType.value}.${path}`;
  return profile.snapshot.element.some((e: any) => 
    e.path.startsWith(fullPath + '.') && e.path.split('.').length > fullPath.split('.').length
  );
}

// Drill down into nested elements
function drillDown(path: string) {
  currentElementPath.value = path;
  loadAvailableElements(path);
}

function updateJson() {
  try {
    jsonOutput.value = JSON.stringify(currentResource.value, null, 2);
    validateResource();
  } catch (error) {
    console.error('Error updating JSON:', error);
    errorMessage.value = 'Error updating JSON: ' + error;
  }
}

function onJsonChange() {
  try {
    const parsed = JSON.parse(jsonOutput.value);
    if (parsed.resourceType) {
      currentResource.value = parsed;
      validateResource();
    }
  } catch (error) {
    console.error('Error parsing JSON:', error);
    errorMessage.value = 'Error parsing JSON: ' + error;
  }
}

function validateResource() {
  validationErrors.value = [];

  if (!currentResource.value.resourceType) {
    validationErrors.value.push('Resource type is required');
  }
  if (!currentResource.value.id) {
    validationErrors.value.push('ID is required');
  }
}

function changeFhirVersion(version: string) {
  currentFhirVersion.value = version;
  showVersionSelector.value = false;
  currentResourceType.value = '';
  currentResource.value = {};
  selectedElements.value = [];
  availableElements.value = [];
  expandedPaths.value = {};
}

function changeResourceType(newType: string) {
  showResourceSelector.value = false;
  initResource(newType);
}

function openResource() {
  showOpenDialog.value = true;
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.resourceType) {
          currentResource.value = parsed;
          currentResourceType.value = parsed.resourceType;
          jsonOutput.value = content;
          errorMessage.value = '';
          showOpenDialog.value = false;
          loadAvailableElements();
          validateResource();
        } else {
          errorMessage.value = 'File does not contain a valid FHIR resource';
        }
      } catch (error) {
        errorMessage.value = 'Error parsing FHIR resource: ' + error;
      }
    };
    reader.readAsText(input.files[0]);
  }
}

function exportResource() {
  showExportDialog.value = true;
}

function copyToClipboard() {
  navigator.clipboard.writeText(jsonOutput.value)
    .then(() => alert('JSON copied to clipboard!'))
    .catch(err => console.error('Could not copy text: ', err));
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentResourceType.value.toLowerCase()}-${currentResource.value.id || 'export'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showExportDialog.value = false;
}

// Initialize
onMounted(() => {
  loadFhirProfiles();
});
</script>

<template>
  <div class="fred-advanced">
    <header class="fred-header">
      <h1>FRED - Advanced FHIR Resource Editor</h1>
      <p class="subtitle">Profile-Based Editing with Hierarchical Elements</p>
    </header>

    <div class="main-container">
      <div class="toolbar">
        <div class="toolbar-group">
          <button @click="openVersionSelector" class="btn-version">
            {{ currentFhirVersion }} ▼
          </button>

          <div v-if="showVersionSelector" class="version-selector-dropdown">
            <div v-for="version in fhirVersions" :key="version.value"
                 @click="changeFhirVersion(version.value)"
                 class="version-option"
                 :class="{ selected: version.value === currentFhirVersion }">
              {{ version.label }}
            </div>
          </div>
        </div>

        <div class="toolbar-group" v-if="currentFhirVersion">
          <button @click="openResourceSelector" class="btn-primary" :disabled="!availableResourceTypes.length">
            {{ currentResourceType || 'Select Resource' }} ▼
          </button>

          <div v-if="showResourceSelector" class="resource-selector-dropdown">
            <div v-for="resourceType in availableResourceTypes" :key="resourceType"
                 @click="changeResourceType(resourceType)"
                 class="resource-option"
                 :class="{ selected: resourceType === currentResourceType }">
              {{ resourceType }}
            </div>
          </div>
        </div>

        <div class="toolbar-group" v-if="currentResourceType">
          <button @click="openElementSelector" class="btn-secondary" :disabled="!availableResourceTypes.length">
            Add Element ▼
          </button>

          <!-- ✅ STEP 2 UPDATE: Show binding indicators in dropdown -->
          <div v-if="showElementSelector" class="element-selector-dropdown">
            <div v-for="element in availableElements" :key="element.path"
                 @click="addElement(element.path, element.type)"
                 class="resource-option"
                 :class="{ 'has-binding': hasValueSetBinding(element.path) }">
              <span>{{ element.name }}</span>
              <span class="type-badge">{{ element.type }}</span>
              <!-- Show indicator if element has ValueSet binding -->
              <span v-if="hasValueSetBinding(element.path)" class="binding-indicator" title="Has ValueSet options">
                📋
              </span>
              <button v-if="hasNestedElements(element.path)" @click.stop="drillDown(element.path)" class="expand-btn">▶</button>
            </div>
          </div>
        </div>

        <div class="toolbar-group" v-if="currentResourceType">
          <button @click="openResource" class="btn-secondary">Open Resource</button>
          <button @click="exportResource" class="btn-secondary">Export</button>
        </div>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <div v-if="validationErrors.length > 0" class="validation-errors">
        <h3>Validation Errors:</h3>
        <ul>
          <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
        </ul>
      </div>

      <div class="editor-container" v-if="currentResourceType">
        <div class="editor-section">
          <h2>Resource Editor - {{ currentFhirVersion }} {{ currentResourceType }}</h2>

          <div class="form-group">
            <label>Resource Type:</label>
            <input v-model="currentResource.resourceType" @change="updateJson" disabled />
          </div>

          <div class="form-group">
            <label>ID:</label>
            <input v-model="currentResource.id" @change="updateJson" />
          </div>

          <!-- Show added elements with hierarchical support -->
          <div class="profile-fields" v-if="selectedElements.length > 0">
            <h3>Resource Elements ({{ selectedElements.length }})</h3>
            <div v-for="element in selectedElements" :key="element.path" class="profile-field">
              <div class="field-header">
                <span class="field-name">{{ element.path }}</span>
                <span v-if="hasValueSetBinding(element.path)" class="binding-badge" title="Has predefined values">
                  📋 Bound
                </span>
                <button @click="removeElement(element.path)" 
                        class="remove-btn" title="Remove element">×</button>
              </div>
              
              <!-- ✅ SMART EDITOR: Dropdown for bound elements, input for regular -->
              <select 
                v-if="hasValueSetBinding(element.path)"
                :value="element.value" 
                @change="updateElementValue(element.path, ($event.target as HTMLSelectElement).value)"
                class="form-select"
              >
                <option value="">-- Select {{ element.name }} --</option>
                <option 
                  v-for="option in getValueSetOptions(element.path)" 
                  :key="option.code" 
                  :value="option.code"
                >
                  {{ option.display }}
                </option>
              </select>
              
              <input 
                v-else
                v-model="element.value" 
                @change="updateElementValue(element.path, element.value)" 
              />
            </div>
          </div>
          
          <div v-else class="no-elements">
            <p>No elements added yet. Click "Add Element" to add fields.</p>
          </div>
        </div>

        <div class="editor-section">
          <h2>JSON Output</h2>
          <textarea v-model="jsonOutput" @change="onJsonChange" class="json-output"></textarea>
          <div class="json-actions">
            <button @click="copyToClipboard" class="btn-small">Copy JSON</button>
            <button @click="downloadJson" class="btn-small">Download JSON</button>
          </div>

          <div class="profile-info" v-if="resourceProfiles[currentFhirVersion]?.[currentResourceType]">
            <h3>Profile Information</h3>
            <p><strong>URL:</strong> {{ resourceProfiles[currentFhirVersion][currentResourceType].url }}</p>
            <p><strong>Name:</strong> {{ resourceProfiles[currentFhirVersion][currentResourceType].name }}</p>
            <p><strong>Version:</strong> {{ resourceProfiles[currentFhirVersion][currentResourceType].version }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Open Resource Dialog -->
    <div v-if="showOpenDialog" class="modal-overlay">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Open FHIR Resource</h3>
          <button @click="showOpenDialog = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <p>Upload a FHIR resource JSON file:</p>
          <input type="file" @change="handleFileUpload" accept=".json" />
          <p class="modal-hint">or drag and drop a file here</p>
          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
        </div>
      </div>
    </div>

    <!-- Export Dialog -->
    <div v-if="showExportDialog" class="modal-overlay">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Export FHIR Resource</h3>
          <button @click="showExportDialog = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <p>Choose export format:</p>
          <button @click="downloadJson" class="btn-primary">Download JSON</button>
          <button @click="copyToClipboard" class="btn-secondary">Copy to Clipboard</button>
        </div>
      </div>
    </div>

    <footer class="fred-footer">
      <p>FHIR Resource Editor - Advanced Profile-Based Implementation</p>
      <p>Hierarchical Elements | Profile-Driven UI | © 2024</p>
    </footer>
  </div>
</template>

<style scoped>
.fred-advanced {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #2c3e50;
  background: linear-gradient(135deg, #5a7bc5 0%, #6a3d9a 100%);
  min-height: 100vh;
}

.fred-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.fred-header h1 {
  color: #2c3e50;
  font-size: 2.2em;
  margin-bottom: 10px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.subtitle {
  color: #7f8c8d;
  font-size: 1.1em;
  font-weight: 300;
}

.main-container {
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(10px);
}

.toolbar {
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
  flex-wrap: wrap;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.toolbar-group {
  display: flex;
  gap: 10px;
  align-items: center;
  position: relative;
}

.version-selector-dropdown,
.resource-selector-dropdown,
.element-selector-dropdown {
  position: absolute;
  background-color: #ffffff;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
  width: 280px;
  top: 100%;
  left: 0;
  animation: fadeIn 0.2s ease-in-out;
  font-size: 13px;
}

.version-option,
.resource-option {
  padding: 10px 15px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  color: #212121;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-option:last-child,
.resource-option:last-child {
  border-bottom: none;
}

.version-option:hover,
.resource-option:hover {
  background-color: #1976d2;
  color: #ffffff;
  transform: translateX(5px);
  font-weight: 500;
}

.version-option.selected,
.resource-option.selected {
  background-color: #1976d2;
  color: #ffffff;
  font-weight: 600;
}

/* ✅ STEP 2: Highlight elements with bindings */
.resource-option.has-binding {
  background-color: #e8f5e9;
  border-left: 3px solid #4caf50;
}

.resource-option.has-binding:hover {
  background-color: #1976d2;
  border-left-color: #1976d2;
}

.type-badge {
  font-size: 11px;
  padding: 2px 6px;
  background-color: #e3f2fd;
  color: #1565c0;
  border-radius: 10px;
  font-weight: 500;
}

/* ✅ STEP 2: Binding indicator styles */
.binding-indicator {
  font-size: 14px;
  margin-left: 5px;
}

.binding-badge {
  font-size: 11px;
  padding: 3px 8px;
  background-color: #e8f5e9;
  color: #2e7d32;
  border-radius: 10px;
  font-weight: 600;
  margin-left: 8px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.editor-container {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}

.editor-section {
  flex: 1;
  border: 1px solid #ddd;
  padding: 15px;
  border-radius: 5px;
  background-color: white;
}

.profile-fields {
  margin: 20px 0;
}

.profile-field {
  margin-bottom: 15px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 5px;
  border-left: 3px solid #42b983;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.field-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1em;
}

.remove-btn {
  background: none;
  border: none;
  color: #c62828;
  font-size: 1.2em;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background-color: #ffebee;
}

.no-elements {
  text-align: center;
  padding: 40px;
  color: #666;
  background-color: #fafafa;
  border-radius: 5px;
  border: 2px dashed #ddd;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #555;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
  color: #333333;
}

.form-group input:disabled {
  background-color: #f5f5f5;
  color: #666;
}

.json-output {
  width: 100%;
  height: 500px;
  font-family: 'Courier New', Courier, monospace;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical;
  background-color: #f5f5f5;
  font-size: 13px;
}

.json-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.profile-info {
  margin-top: 20px;
  padding: 15px;
  background-color: #f0f8ff;
  border-radius: 5px;
  font-size: 0.9em;
}

.profile-info p {
  margin: 8px 0;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #ef9a9a;
}

.validation-errors {
  background-color: #fff8e1;
  color: #e65100;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #ffca28;
}

.validation-errors ul {
  margin: 8px 0 0 20px;
  padding: 0;
}

.validation-errors li {
  margin-bottom: 4px;
}

.btn-version {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.btn-version:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

.btn-primary {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

.btn-primary:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #333;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

.btn-secondary:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-small {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  color: #333;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.btn-small:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
}

.expand-btn {
  background: none;
  border: 1px solid #999;
  color: #666;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  margin-left: 5px;
}

.expand-btn:hover {
  background-color: #e3f2fd;
  border-color: #1976d2;
  color: #1976d2;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-dialog {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  width: 500px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
  color: #999;
  padding: 0;
  line-height: 1;
}

.modal-body {
  padding: 10px 0;
}

.modal-hint {
  font-size: 0.9em;
  color: #666;
  margin-top: 10px;
  font-style: italic;
}

.fred-footer {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  text-align: center;
  color: #666;
  font-size: 14px;
}

h2 {
  color: #34495e;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-top: 0;
}

@media (max-width: 768px) {
  .editor-container {
    flex-direction: column;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}

.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #4caf50; /* Green border for bound fields */
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
  color: #333333;
  background-color: #fff;
  cursor: pointer;
}

.form-select:focus {
  outline: none;
  border-color: #2e7d32;
  box-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
}
</style>