<script setup lang="ts">
// ============================================
// IMPORTS
// ============================================
import valueSetLoader from '@/services/valueSetLoader';
import ComplexTypeField from './ComplexTypeField.vue';
import { isComplexType, isPrimitiveType } from '@/fhir/complexTypes';
import { ref, computed, onMounted } from 'vue';

// FHIR Versions and Profiles
const fhirVersions: { value: string, label: string, profiles: Record<string, any> }[] = [
  { value: 'R4', label: 'FHIR R4', profiles: {} },
  { value: 'R5', label: 'FHIR R5', profiles: {} },
  { value: 'STU3', label: 'FHIR STU3', profiles: {} },
  { value: 'DSTU2', label: 'FHIR DSTU2', profiles: {} }
];

// ============================================
// MAIN STATE
// ============================================

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
const selectedElements = ref<{name: string, path: string, value: any, type: string, binding?: any, min?: number, max?: string}[]>([]);
const availableElements = ref<{name: string, path: string, type: string, definition: string, binding: any, min?: number, max?: string}[]>([]);
const expandedPaths = ref<Record<string, boolean>>({});
const currentElementPath = ref('');

// Complex type management
const expandedComplexTypes = ref<Record<string, boolean>>({});

// ============================================
// COMPUTED PROPERTIES
// ============================================

// Detect elements with ValueSet bindings
const hasValueSetBinding = computed(() => {
  return (elementPath: string) => {
    const element = availableElements.value.find(e => e.path === elementPath);
    return !!element?.binding &&
           ['required', 'extensible', 'preferred'].includes(element.binding.strength);
  };
});

// Get binding info for an element path (for displaying binding strength in UI)
function getElementBinding(elementPath: string): any {
  const element = availableElements.value.find(e => e.path === elementPath);
  return element?.binding || null;
}

// Determine how to render an element (complex/bound/primitive)
function getElementType(elementType: string): string {
  if (isComplexType(elementType)) return 'complex';
  if (isPrimitiveType(elementType)) return 'primitive';
  return 'unknown';
}

// Map FHIR types to HTML input types
function getInputType(elementType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'text',
    'code': 'text',
    'uri': 'url',
    'url': 'url',
    'canonical': 'url',
    'boolean': 'checkbox',
    'integer': 'number',
    'unsignedInt': 'number',
    'positiveInt': 'number',
    'decimal': 'number',
    'dateTime': 'datetime-local',
    'date': 'date',
    'instant': 'datetime-local',
    'time': 'time',
    'base64Binary': 'text',
    'id': 'text',
    'markdown': 'text',
    'oid': 'text',
    'string': 'text'
  };
  return typeMap[elementType] || 'text';
}

// ============================================
// VALUESET LOADING
// ============================================

/**
 * Get ValueSet options for a bound element.
 * Synchronous — data is imported statically via Vite, always available.
 */
function getValueSetOptions(elementPath: string): {code: string, display: string}[] {
  const element = availableElements.value.find(e => e.path === elementPath);
  const bindingUrl = (element && element.binding && element.binding.valueSet) || '';
  if (!bindingUrl) return [];
  return valueSetLoader.getOptions(bindingUrl);
}

// ============================================
// COMPLEX TYPE HANDLING
// ============================================

function toggleComplexType(path: string) {
  expandedComplexTypes.value[path] = !expandedComplexTypes.value[path];
}

function shouldAutoExpandComplexType(path: string): boolean {
  const value = getValueAtPath(currentResource.value, path);
  return value !== undefined && value !== null &&
         (typeof value === 'object' ? Object.keys(value).length > 0 : !!value);
}

function getValueAtPath(data: any, path: string): any {
  if (!data || !path) return undefined;

  const parts = path.split('.');
  let current = data;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }

  return current;
}

function handleComplexTypeUpdate(updateEvent: {path: string, value: any}) {
  const { path, value } = updateEvent;
  setNestedValue(currentResource.value, path, value);
  updateJson();
}

// ============================================
// EXISTING METHODS
// ============================================

// Close all dropdowns when clicking outside
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.toolbar-group')) {
    showVersionSelector.value = false;
    showResourceSelector.value = false;
    showElementSelector.value = false;
  }
});

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
    const r4Resources: any = await import('../../fhir_profiles/R4/profiles-resources.json');
    const r4Types: any = await import('../../fhir_profiles/R4/profiles-types.json');

    const allStructureDefinitions: any[] = [];

    if (r4Resources.default?.entry) {
      allStructureDefinitions.push(...r4Resources.default.entry
        .map((e: any) => e.resource)
        .filter((r: any) => r.resourceType === 'StructureDefinition'));
    }

    if (r4Types.default?.entry) {
      allStructureDefinitions.push(...r4Types.default.entry
        .map((e: any) => e.resource)
        .filter((r: any) => r.resourceType === 'StructureDefinition'));
    }

    const resourceMap: Record<string, any> = {};
    allStructureDefinitions.forEach((sd) => {
      const resourceType = sd.type || sd.url?.split('/').pop()?.split('|')[0];
      if (resourceType) {
        resourceMap[resourceType] = sd;
      }
    });

    fhirVersions[0].profiles = resourceMap;
    resourceProfiles.value.R4 = resourceMap;

    const canonicalResourceTypes = [
      'Patient', 'RelatedPerson', 'Practitioner', 'PractitionerRole', 'Organization',
      'Observation', 'Condition', 'Encounter', 'MedicationRequest', 'Procedure',
      'Location', 'Device', 'AllergyIntolerance', 'Immunization', 'CarePlan',
      'DiagnosticReport', 'Specimen', 'ServiceRequest', 'Medication', 'Goal'
    ];

    availableResourceTypes.value = Object.keys(resourceMap)
      .filter((type) => canonicalResourceTypes.includes(type))
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

  selectedElements.value = [];
  availableElements.value = [];
  expandedPaths.value = {};
  expandedComplexTypes.value = {};

  updateJson();
  loadAvailableElements();
}

// Load available elements for current resource type
function loadAvailableElements(parentPath: string = '') {
  const profile = resourceProfiles.value[currentFhirVersion.value]?.[currentResourceType.value];
  if (!profile?.snapshot?.element) {
    availableElements.value = [];
    return;
  }

  const basePath = parentPath ? `${currentResourceType.value}.${parentPath}` : currentResourceType.value;
  const elements = profile.snapshot.element
    .filter((e: any) => {
      const pathParts = e.path.split('.');

      if (!parentPath) {
        return pathParts.length === 2 && pathParts[0] === currentResourceType.value;
      }

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
        binding: e.binding || null,
        min: e.min || 0,
        max: e.max || '1'
      };
    })
    .sort((a: any, b: any) => {
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

// Add element to resource
function addElement(elementPath: string, elementType: string) {
  // Prevent duplicate elements
  if (selectedElements.value.some(e => e.path === elementPath)) {
    showElementSelector.value = false;
    return;
  }

  let defaultValue: any;

  if (isComplexType(elementType)) {
    defaultValue = createEmptyComplexObject(elementType);
  } else {
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
      default:
        defaultValue = '';
    }
  }

  const elementName = elementPath.split('.').pop() || elementPath;

  // Look up binding info from availableElements so it's available on selectedElements
  const availableElem = availableElements.value.find(e => e.path === elementPath);

  selectedElements.value.push({
    name: elementName,
    path: elementPath,
    value: defaultValue,
    type: elementType,
    binding: availableElem?.binding || null,
    min: availableElem?.min,
    max: availableElem?.max
  });

  setNestedValue(currentResource.value, elementPath, defaultValue);

  updateJson();
  showElementSelector.value = false;
}

/**
 * Create empty object template for complex FHIR types
 */
function createEmptyComplexObject(typeName: string): any {
  const templates: Record<string, any> = {
    'HumanName': { use: 'official', text: '', family: '', given: [], prefix: [], suffix: [] },
    'Address': { use: 'home', text: '', line: [], city: '', district: '', state: '', postalCode: '', country: '' },
    'Identifier': { use: 'usual', system: '', value: '' },
    'CodeableConcept': { coding: [], text: '' },
    'Coding': { system: '', code: '', display: '' },
    'ContactPoint': { system: 'phone', value: '', use: 'home' },
    'Attachment': { contentType: '', data: '' },
    'Quantity': { value: 0, unit: '', system: '', code: '' },
    'Period': { start: '', end: '' },
    'Reference': { reference: '', display: '' },
    'Range': { low: {}, high: {} },
    'Ratio': { numerator: {}, denominator: {} },
    'Timing': { event: [], repeat: {} },
    'Annotation': { authorString: '', time: '', text: '' }
  };

  return templates[typeName] || {};
}

// Remove element from resource
function removeElement(elementPath: string) {
  selectedElements.value = selectedElements.value.filter(e => e.path !== elementPath);
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

// Helper functions
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

function toggleExpand(path: string) {
  expandedPaths.value[path] = !expandedPaths.value[path];
}

function hasNestedElements(path: string): boolean {
  const profile = resourceProfiles.value[currentFhirVersion.value]?.[currentResourceType.value];
  if (!profile?.snapshot?.element) return false;

  const fullPath = `${currentResourceType.value}.${path}`;
  return profile.snapshot.element.some((e: any) =>
    e.path.startsWith(fullPath + '.') && e.path.split('.').length > fullPath.split('.').length
  );
}

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

// ============================================
// INITIALIZATION
// ============================================

onMounted(() => {
  loadFhirProfiles();
  // ValueSet index is imported statically — already loaded, no async init needed
  console.log('ValueSet loader ready:', valueSetLoader.getStats());
});
</script>

<template>
  <div class="fred-advanced">
    <header class="fred-header">
      <h1>FRED - Advanced FHIR Resource Editor</h1>
      <p class="subtitle">Profile-Based Editing with Hierarchical Elements</p>
    </header>

    <div class="main-container">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-group">
          <button @click="openVersionSelector" class="btn-version">
            {{ currentFhirVersion }} &#9662;
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
            {{ currentResourceType || 'Select Resource' }} &#9662;
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
          <button @click="openElementSelector" class="btn-secondary">
            Add Element &#9662;
          </button>

          <div v-if="showElementSelector" class="element-selector-dropdown">
            <div v-for="element in availableElements" :key="element.path"
                 @click="addElement(element.path, element.type)"
                 class="resource-option"
                 :class="{ 'has-binding': hasValueSetBinding(element.path) }">
              <span>{{ element.name }}</span>
              <span class="type-badge">{{ element.type }}</span>

              <span v-if="hasValueSetBinding(element.path)" class="binding-indicator" title="Has ValueSet options">
                &#128203;
              </span>

              <button v-if="hasNestedElements(element.path)" @click.stop="drillDown(element.path)" class="expand-btn">&#9654;</button>
            </div>
          </div>
        </div>

        <div class="toolbar-group" v-if="currentResourceType">
          <button @click="openResource" class="btn-secondary">Open Resource</button>
          <button @click="exportResource" class="btn-secondary">Export</button>
        </div>
      </div>

      <!-- Breadcrumb for drill-down navigation -->
      <div v-if="currentElementPath" class="breadcrumb">
        <span class="breadcrumb-item" @click="currentElementPath = ''; loadAvailableElements('')" style="cursor:pointer;">
          {{ currentResourceType }}
        </span>
        <template v-for="(part, idx) in currentElementPath.split('.')" :key="idx">
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-item" @click="loadAvailableElements(currentElementPath.split('.').slice(0, idx + 1).join('.'))" style="cursor:pointer;">
            {{ part }}
          </span>
        </template>
      </div>

      <!-- Error messages -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
        <button @click="errorMessage = ''" style="float:right; background:none; border:none; cursor:pointer; font-size:1.2em;">&times;</button>
      </div>

      <div v-if="validationErrors.length > 0" class="validation-errors">
        <h3>Validation Errors:</h3>
        <ul>
          <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
        </ul>
      </div>

      <!-- EDITOR CONTAINER -->
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

          <!-- ELEMENTS LIST WITH CONDITIONAL RENDERING -->
          <div class="profile-fields" v-if="selectedElements.length > 0">
            <h3>Resource Elements ({{ selectedElements.length }})</h3>

            <div v-for="element in selectedElements" :key="element.path" class="profile-field">

              <div class="field-header">
                <span class="field-name">{{ element.path }}</span>

                <!-- Cardinality badge -->
                <span v-if="element.min !== undefined" class="cardinality-badge" title="Cardinality">
                  {{ element.min }}..{{ element.max }}
                </span>

                <!-- Type badge -->
                <span class="type-badge">{{ element.type }}</span>

                <!-- Binding indicator -->
                <span v-if="hasValueSetBinding(element.path)"
                      class="binding-badge"
                      title="Has predefined values">
                  &#128203; Bound
                </span>

                <button @click="removeElement(element.path)"
                        class="remove-btn"
                        title="Remove element">&times;</button>
              </div>

              <!-- CASE 1: COMPLEX TYPE (HumanName, Address, etc.) -->
              <complex-type-field
                v-if="getElementType(element.type) === 'complex'"
                :element="element"
                :resource-data="currentResource"
                :element-path="element.path"
                :default-expanded="shouldAutoExpandComplexType(element.path)"
                @update="handleComplexTypeUpdate"
              />

              <!-- CASE 2: BOUND ELEMENT with ValueSet (gender, etc.) -->
              <div v-else-if="hasValueSetBinding(element.path)" class="field-bound">

                <!-- Dropdown with options (synchronous from static index) -->
                <select
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

                  <option value="__custom__">Enter custom value...</option>
                </select>

                <!-- Custom value input (when "__custom__" selected) -->
                <input
                  v-if="element.value === '__custom__'"
                  type="text"
                  class="custom-input"
                  placeholder="Enter custom value"
                  @input="updateElementValue(element.path, ($event.target as HTMLInputElement).value)"
                />

                <!-- Binding metadata -->
                <div class="binding-meta">
                  <small class="binding-strength"
                        :class="getElementBinding(element.path)?.strength || ''">
                    {{ getElementBinding(element.path)?.strength || '' }}
                  </small>
                </div>
              </div>

              <!-- CASE 3: PRIMITIVE TYPE (string, integer, etc.) -->
              <div v-else class="field-primitive">
                <input
                  :type="getInputType(element.type)"
                  v-model="element.value"
                  @change="updateElementValue(element.path, element.value)"
                  :placeholder="'Enter ' + element.name"
                  class="primitive-input"
                />
              </div>

            </div>
          </div>

          <div v-else class="no-elements">
            <p>No elements added yet. Click "Add Element" to add fields.</p>
          </div>
        </div>

        <!-- JSON Output Section -->
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

    <!-- Dialogs -->
    <div v-if="showOpenDialog" class="modal-overlay" @click.self="showOpenDialog = false">
      <div class="modal-dialog">
        <h3>Open FHIR Resource</h3>
        <p>Select a JSON file containing a FHIR resource:</p>
        <input type="file" accept=".json" @change="handleFileUpload" />
        <button @click="showOpenDialog = false" class="btn-small" style="margin-top: 15px;">Cancel</button>
      </div>
    </div>

    <div v-if="showExportDialog" class="modal-overlay" @click.self="showExportDialog = false">
      <div class="modal-dialog">
        <h3>Export Resource</h3>
        <p>Choose an export option:</p>
        <div class="export-actions">
          <button @click="copyToClipboard" class="btn-primary">Copy to Clipboard</button>
          <button @click="downloadJson" class="btn-primary">Download JSON File</button>
          <button @click="showExportDialog = false" class="btn-small" style="margin-top: 15px;">Cancel</button>
        </div>
      </div>
    </div>

    <footer class="fred-footer">
      <p>FHIR Resource Editor - Advanced Profile-Based Implementation</p>
      <p>Hierarchical Elements | Profile-Driven UI</p>
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

.cardinality-badge {
  font-size: 10px;
  padding: 2px 6px;
  background-color: #fff3e0;
  color: #e65100;
  border-radius: 10px;
  font-weight: 500;
  margin-left: 4px;
}

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

.breadcrumb {
  margin-bottom: 15px;
  padding: 8px 12px;
  background: #f0f4ff;
  border-radius: 6px;
  font-size: 13px;
}

.breadcrumb-item {
  color: #1976d2;
  font-weight: 500;
}

.breadcrumb-item:hover {
  text-decoration: underline;
}

.breadcrumb-sep {
  color: #999;
  margin: 0 4px;
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
  flex-wrap: wrap;
  gap: 6px;
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

.field-bound {
  margin-top: 8px;
}

.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
  color: #333333;
  background-color: white;
  cursor: pointer;
}

.form-select:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
}

.custom-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #42b983;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
  margin-top: 6px;
}

.loading-hint {
  font-size: 11px;
  color: #888;
  font-style: italic;
  margin-bottom: 4px;
}

.binding-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.binding-strength {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.binding-strength.required {
  color: #c62828;
  background-color: #ffebee;
}

.binding-strength.extensible {
  color: #e65100;
  background-color: #fff3e0;
}

.binding-strength.preferred {
  color: #1565c0;
  background-color: #e3f2fd;
}

.binding-strength.example {
  color: #2e7d32;
  background-color: #e8f5e9;
}

.btn-reload-options {
  background: none;
  border: 1px solid #ccc;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
}

.btn-reload-options:hover {
  background-color: #f5f5f5;
  border-color: #999;
}

.field-primitive {
  margin-top: 8px;
}

.primitive-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
  color: #333333;
}

.primitive-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
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
  background: white;
  border-radius: 10px;
  padding: 25px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.modal-dialog h3 {
  margin-top: 0;
  color: #2c3e50;
}

.modal-dialog input[type="file"] {
  margin-top: 10px;
  width: 100%;
}

.export-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
}

.fred-footer {
  margin-top: 30px;
  text-align: center;
  padding: 15px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9em;
}

.fred-footer p {
  margin: 4px 0;
}

@media (max-width: 768px) {
  .editor-container {
    flex-direction: column;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-group {
    width: 100%;
  }

  .version-selector-dropdown,
  .resource-selector-dropdown,
  .element-selector-dropdown {
    width: 100%;
  }
}
</style>