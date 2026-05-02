<script setup lang="ts">
// ============================================
// IMPORTS
// ============================================
import valueSetLoader from '@/services/valueSetLoader';
import ComplexTypeField from './ComplexTypeField.vue';
import { isComplexType, isPrimitiveType } from '@/fhir/complexTypes';
import { ref, computed, watch, onMounted, markRaw, nextTick } from 'vue';

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

// Open Resource dialog state
const openDialogTab = ref<'paste' | 'file' | 'url'>('paste');
const pastedJson = ref('');
const resourceUrl = ref('');
const isUrlLoading = ref(false);
const openDialogError = ref('');
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

// Dropdown search filters
const resourceSearchQuery = ref('');
const elementSearchQuery = ref('');
const resourceSearchInput = ref<HTMLInputElement | null>(null);
const elementSearchInput = ref<HTMLInputElement | null>(null);
const highlightedResourceIndex = ref(-1);
const highlightedElementIndex = ref(-1);

// ============================================
// DROPDOWN SEARCH / KEYBOARD NAVIGATION
// ============================================

// Reset highlight index whenever the search query changes
watch(resourceSearchQuery, () => { highlightedResourceIndex.value = -1; });
watch(elementSearchQuery, () => { highlightedElementIndex.value = -1; });

function highlightNextResource() {
  const max = filteredResourceTypes.value.length - 1;
  highlightedResourceIndex.value = highlightedResourceIndex.value < max ? highlightedResourceIndex.value + 1 : 0;
}

function highlightPrevResource() {
  const max = filteredResourceTypes.value.length - 1;
  highlightedResourceIndex.value = highlightedResourceIndex.value > 0 ? highlightedResourceIndex.value - 1 : max;
}

function selectHighlightedResource() {
  if (highlightedResourceIndex.value >= 0 && highlightedResourceIndex.value < filteredResourceTypes.value.length) {
    changeResourceType(filteredResourceTypes.value[highlightedResourceIndex.value]);
  }
}

function highlightNextElement() {
  const max = filteredElements.value.length - 1;
  highlightedElementIndex.value = highlightedElementIndex.value < max ? highlightedElementIndex.value + 1 : 0;
}

function highlightPrevElement() {
  const max = filteredElements.value.length - 1;
  highlightedElementIndex.value = highlightedElementIndex.value > 0 ? highlightedElementIndex.value - 1 : max;
}

function selectHighlightedElement() {
  if (highlightedElementIndex.value >= 0 && highlightedElementIndex.value < filteredElements.value.length) {
    const el = filteredElements.value[highlightedElementIndex.value];
    addElement(el.path, el.type);
  }
}

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

// Filtered resource types for the search dropdown (consecutive-character / substring match)
const filteredResourceTypes = computed<string[]>(() => {
  const query = resourceSearchQuery.value.trim().toLowerCase();
  if (!query) return availableResourceTypes.value;
  return availableResourceTypes.value.filter(r => r.toLowerCase().includes(query));
});

// Filtered elements for the search dropdown (consecutive-character / substring match)
// Also excludes single-cardinality elements (max=1) that have already been added.
const filteredElements = computed<typeof availableElements.value>(() => {
  // Cardinality filter: remove 0..1 or 1..1 elements already selected
  const cardinalityFiltered = availableElements.value.filter(e => {
    const maxVal = e.max || '1';
    const isSingle = maxVal === '1' || (parseInt(maxVal) === 1);
    if (!isSingle) return true;
    return !selectedElements.value.some(s => s.path === e.path);
  });

  const query = elementSearchQuery.value.trim().toLowerCase();
  if (!query) return cardinalityFiltered;
  return cardinalityFiltered.filter(e =>
    e.name.toLowerCase().includes(query) ||
    e.type.toLowerCase().includes(query) ||
    e.path.toLowerCase().includes(query)
  );
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
// PROFILE-BASED SUB-FIELDS
// ============================================

/**
 * Get sub-fields for an element from the FHIR profile snapshot.
 * Used for BackboneElement and other types not defined in complexTypes.js.
 * Returns sub-fields in the same format as getComplexTypeDefinition().
 */
function getProfileSubFields(elementPath: string): any[] {
  const profile = resourceProfiles.value[currentFhirVersion.value]?.[currentResourceType.value];
  if (!profile?.snapshot?.element) return [];

  // Build the full FHIR path: e.g., "Patient.contact"
  const fullPath = `${currentResourceType.value}.${elementPath}`;

  // Skip metadata fields that clutter the editor for BackboneElement children
  const skipFields = ['id', 'extension', 'modifierExtension'];

  return profile.snapshot.element
    .filter((e: any) => {
      const pathParts = e.path.split('.');
      const childName = pathParts[pathParts.length - 1];

      // Must be exactly one level deeper than fullPath
      // and not a metadata field
      return e.path.startsWith(fullPath + '.') &&
             pathParts.length === (fullPath.split('.').length + 1) &&
             !skipFields.includes(childName);
    })
    .map((e: any) => {
      const childName = e.path.split('.').pop();
      return {
        id: `${elementPath}.${childName}`,
        path: `${elementPath}.${childName}`,
        name: childName,
        type: e.type || [{ code: 'BackboneElement' }],
        min: e.min || 0,
        max: e.max || '1',
        binding: e.binding || null,
        shortDescription: e.short || e.definition || ''
      };
    });
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
  resourceSearchQuery.value = '';
  highlightedResourceIndex.value = -1;
  showResourceSelector.value = true;
  showVersionSelector.value = false;
  showElementSelector.value = false;
  nextTick(() => {
    resourceSearchInput.value?.focus();
  });
}

function openElementSelector() {
  currentElementPath.value = '';
  elementSearchQuery.value = '';
  highlightedElementIndex.value = -1;
  loadAvailableElements('');
  showElementSelector.value = true;
  showVersionSelector.value = false;
  showResourceSelector.value = false;
  nextTick(() => {
    elementSearchInput.value?.focus();
  });
}

// ============================================
// PROFILE LOADING (Lazy — manifest first, profiles on demand)
// ============================================

const profileCache = ref<Record<string, any>>({});

/**
 * Load the small manifest (~5 KB) to populate the resource type dropdown instantly.
 */
async function loadResourceTypeList() {
  try {
    const response = await fetch('/fhir_profiles/R4/manifest.json');
    if (!response.ok) throw new Error(`Manifest fetch failed: ${response.status}`);
    const manifest = await response.json();

    if (manifest.R4) {
      // Populate dropdown with resource types from manifest
      const types = manifest.R4.resourceTypes || [];
      availableResourceTypes.value = types.sort();
      console.log(`Resource type list loaded: ${types.length} types (from manifest)`);
    }
  } catch (error) {
    console.error('Error loading resource type manifest:', error);
    errorMessage.value = 'Error loading resource types. Run: node scripts/split-profiles.js';
  }
}

/**
 * Load a single resource profile on demand when the user selects a resource type.
 * Typical size: 20-200 KB (vs 138 MB for the full bundle).
 * Results are cached — subsequent selections of the same type are instant.
 */
async function loadProfileForResource(resourceType: string) {
  // Return from cache if already loaded
  if (profileCache.value[resourceType]) {
    return profileCache.value[resourceType];
  }

  try {
    // Try fetching the individual resource profile
    const response = await fetch(`/fhir_profiles/R4/resources/${resourceType}.json`);
    if (response.ok) {
      const profile = markRaw(await response.json());
      profileCache.value[resourceType] = profile;

      // Also cache in resourceProfiles for profile sub-field lookups
      if (!resourceProfiles.value.R4) {
        resourceProfiles.value.R4 = {};
      }
      resourceProfiles.value.R4[resourceType] = profile;

      console.log(`Profile loaded: ${resourceType} (${(JSON.stringify(profile).length / 1024).toFixed(0)} KB)`);
      return profile;
    }
  } catch (err) {
    console.warn(`Failed to load profile for ${resourceType} from split files:`, err);
  }

  // Fallback: try types directory (for complex types like HumanName, Address)
  try {
    const response = await fetch(`/fhir_profiles/R4/types/${resourceType}.json`);
    if (response.ok) {
      const profile = markRaw(await response.json());
      profileCache.value[resourceType] = profile;

      if (!resourceProfiles.value.R4) {
        resourceProfiles.value.R4 = {};
      }
      resourceProfiles.value.R4[resourceType] = profile;

      console.log(`Type profile loaded: ${resourceType}`);
      return profile;
    }
  } catch (err) {
    console.warn(`Failed to load type profile for ${resourceType}:`, err);
  }

  console.warn(`No profile found for ${resourceType}`);
  return null;
}

// Initialize resource when type is selected
async function initResource(resourceType: string) {
  currentResourceType.value = resourceType;
  currentResource.value = {
    resourceType: resourceType
  };

  selectedElements.value = [];
  availableElements.value = [];
  expandedPaths.value = {};
  expandedComplexTypes.value = {};

  updateJson();

  // Load the profile for this resource type on demand
  await loadProfileForResource(resourceType);

  // Now load available elements from the profile
  loadAvailableElements();
}

// ============================================
// ELEMENT SYNC FROM RESOURCE DATA
// ============================================

/**
 * Sync selectedElements with the current resource data.
 * Used when loading a resource from JSON so the editor UI
 * reflects all elements already present in the resource.
 */
function syncElementsFromResource() {
  const resource = currentResource.value;
  const resourceType = currentResourceType.value;

  selectedElements.value = [];

  if (!resource || !resourceType) return;

  // Load the available elements from the profile first
  loadAvailableElements();

  const profile = resourceProfiles.value[currentFhirVersion.value]?.[resourceType];
  if (!profile?.snapshot?.element) return;

  // Build a lookup of profile elements by path suffix (the field name)
  const basePath = resourceType;
  const profileElementsByPath: Record<string, any> = {};
  profile.snapshot.element
    .filter((e: any) => {
      const parts = e.path.split('.');
      return parts.length === 2 && parts[0] === basePath;
    })
    .forEach((e: any) => {
      const fieldName = e.path.split('.').pop();
      profileElementsByPath[fieldName] = e;
    });

  // Iterate through each key in the resource (skip resourceType)
  for (const key of Object.keys(resource)) {
    if (key === 'resourceType') continue;

    const value = resource[key];

    // Look up the element definition from the profile
    const profileElement = profileElementsByPath[key];
    const elementType = profileElement?.type?.[0]?.code ||
      inferTypeFromValue(value) || 'string';
    const elementPath = key;
    const elementName = key;

    // Skip metadata fields the user didn't intentionally add
    if (['id', 'meta', 'implicitRules', 'language', 'contained'].includes(key)) continue;

    // Get binding info from profile
    const binding = profileElement?.binding || null;

    // Pre-compute profile sub-fields for BackboneElement types
    const profileSubFields = getProfileSubFields(elementPath);
    const rawProfileSubFields = profileSubFields.length > 0
      ? markRaw(structuredClone(profileSubFields))
      : undefined;

    selectedElements.value.push({
      name: elementName,
      path: elementPath,
      value: value,
      type: elementType,
      binding: binding,
      min: profileElement?.min || 0,
      max: profileElement?.max || '1',
      profileSubFields: rawProfileSubFields
    });
  }

  updateJson();
}

/**
 * Infer FHIR type from a JavaScript value when no profile is available.
 * Best-effort heuristic for JSON files that may not have matching profiles.
 */
function inferTypeFromValue(value: any): string {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'decimal';
  if (typeof value === 'string') {
    // Heuristic: detect URIs and date/time strings
    if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(value)) return 'dateTime';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    if (/^https?:\/\//.test(value)) return 'uri';
    return 'string';
  }
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object') {
      return inferComplexTypeName(value[0]) || 'BackboneElement';
    }
    return 'string'; // array of primitives
  }
  if (typeof value === 'object') {
    return inferComplexTypeName(value) || 'BackboneElement';
  }
  return 'string';
}

/**
 * Heuristic: guess the FHIR complex type name from an object's keys.
 * E.g., { use, family, given } → HumanName, { line, city, postalCode } → Address
 */
function inferComplexTypeName(obj: Record<string, any>): string {
  if (!obj || typeof obj !== 'object') return '';

  const keys = Object.keys(obj).sort();

  const typeSignatures: Record<string, string[]> = {
    'HumanName': ['family', 'given', 'prefix', 'suffix', 'text', 'use', 'period'],
    'Address': ['city', 'country', 'district', 'line', 'period', 'postalCode', 'state', 'text', 'type', 'use'],
    'Identifier': ['assigner', 'period', 'system', 'type', 'use', 'value'],
    'CodeableConcept': ['coding', 'text'],
    'Coding': ['code', 'display', 'system', 'userSelected', 'version'],
    'ContactPoint': ['period', 'rank', 'system', 'use', 'value'],
    'Period': ['end', 'start'],
    'Quantity': ['code', 'comparator', 'system', 'unit', 'value'],
    'Reference': ['display', 'identifier', 'reference', 'type'],
    'Attachment': ['contentType', 'creation', 'data', 'hash', 'language', 'size', 'title', 'url'],
    'Annotation': ['authorReference', 'authorString', 'text', 'time'],
    'Timing': ['code', 'event', 'repeat'],
    'Range': ['high', 'low'],
    'Ratio': ['denominator', 'numerator'],
  };

  for (const [typeName, signature] of Object.entries(typeSignatures)) {
    // Match if the object shares at least 60% of the type's known keys
    const overlap = keys.filter(k => signature.includes(k)).length;
    if (overlap >= 2 && overlap >= keys.length * 0.5) {
      return typeName;
    }
  }

  return '';
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
    // If element is an array type (max > 1 or *), wrap in array
    const availElem = availableElements.value.find(e => e.path === elementPath);
    if (availElem && (availElem.max === '*' || (parseInt(availElem.max) > 1))) {
      defaultValue = [defaultValue];
    }
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

  // Pre-compute profile sub-fields for BackboneElement types (stable reference, avoids template re-evaluation)
  const profileSubFields = getProfileSubFields(elementPath);

  // Mark profileSubFields as raw to prevent Vue from creating deep reactive proxies.
  // These are static configuration data from the FHIR profile that never change.
  // Deep reactivity on this data causes infinite recursion in Vue's shallowReadonly
  // during component setup when BackboneElements are nested.
  const rawProfileSubFields = profileSubFields.length > 0
    ? markRaw(structuredClone(profileSubFields))
    : undefined;

  selectedElements.value.push({
    name: elementName,
    path: elementPath,
    value: defaultValue,
    type: elementType,
    binding: availableElem?.binding || null,
    min: availableElem?.min,
    max: availableElem?.max,
    profileSubFields: rawProfileSubFields
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

// Remove empty/null/undefined values from an object recursively
function stripEmpty(obj: any): any {
  if (Array.isArray(obj)) {
    // Keep arrays that have at least one non-empty item
    const filtered = obj.map(stripEmpty).filter((item: any) => item !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }

  if (obj === null || obj === undefined) return undefined;

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = stripEmpty(obj[key]);
      if (val !== undefined) {
        result[key] = val;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  // Primitives: keep falsy but meaningful values (0, false), drop only empty strings
  if (obj === '') return undefined;

  return obj;
}

function updateJson() {
  try {
    const clean = stripEmpty(currentResource.value);
    jsonOutput.value = JSON.stringify(clean, null, 2);
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
      currentResourceType.value = parsed.resourceType;

      // If the profile is already loaded, sync elements immediately.
      // Otherwise it will sync after profile loads on next resource type change.
      const profile = resourceProfiles.value[currentFhirVersion.value]?.[parsed.resourceType];
      if (profile?.snapshot?.element) {
        syncElementsFromResource();
      }

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
  // Reset dialog state
  openDialogTab.value = 'paste';
  pastedJson.value = '';
  resourceUrl.value = '';
  openDialogError.value = '';
  isUrlLoading.value = false;
  showOpenDialog.value = true;
}

/**
 * Shared handler: process a parsed FHIR resource JSON object.
 * Loads the profile, syncs elements into the editor UI, and closes the dialog.
 */
async function processLoadedResource(parsed: any) {
  if (!parsed || !parsed.resourceType) {
    openDialogError.value = 'JSON does not contain a valid FHIR resource (missing "resourceType" field)';
    return;
  }

  const resourceType = parsed.resourceType;

  // Reset editor state
  currentResource.value = parsed;
  currentResourceType.value = resourceType;
  errorMessage.value = '';
  openDialogError.value = '';
  showOpenDialog.value = false;
  expandedPaths.value = {};
  expandedComplexTypes.value = {};
  currentElementPath.value = '';

  // Load profile first, then sync elements from the loaded data
  await loadProfileForResource(resourceType);
  syncElementsFromResource();

  validateResource();
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    openDialogError.value = '';
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        await processLoadedResource(parsed);
      } catch (error: any) {
        openDialogError.value = 'Error parsing FHIR resource: ' + error.message;
      }
    };
    reader.readAsText(input.files[0]);
  }
}

function loadFromPaste() {
  openDialogError.value = '';
  const trimmed = pastedJson.value.trim();
  if (!trimmed) {
    openDialogError.value = 'Please paste a FHIR resource JSON';
    return;
  }
  try {
    const parsed = JSON.parse(trimmed);
    processLoadedResource(parsed);
  } catch (error: any) {
    openDialogError.value = 'Invalid JSON: ' + error.message;
  }
}

async function loadFromUrl() {
  openDialogError.value = '';
  const url = resourceUrl.value.trim();
  if (!url) {
    openDialogError.value = 'Please enter a URL';
    return;
  }
  // Basic URL validation
  try {
    new URL(url);
  } catch {
    openDialogError.value = 'Please enter a valid URL (e.g., https://...)';
    return;
  }

  isUrlLoading.value = true;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json') && !contentType.includes('application/fhir+json')) {
      // Still try to parse — some servers don't set content-type correctly
      console.warn('URL did not return JSON content-type, attempting parse anyway');
    }
    const text = await response.text();
    const parsed = JSON.parse(text);
    await processLoadedResource(parsed);
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      openDialogError.value = 'The URL did not return valid JSON';
    } else {
      openDialogError.value = 'Failed to fetch resource: ' + error.message;
    }
  } finally {
    isUrlLoading.value = false;
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
  loadResourceTypeList();
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

          <div v-if="showResourceSelector" class="resource-selector-dropdown" @click.stop>
            <input
              ref="resourceSearchInput"
              v-model="resourceSearchQuery"
              class="dropdown-search"
              type="text"
              placeholder="Search resources..."
              @keydown.down.prevent="highlightNextResource"
              @keydown.up.prevent="highlightPrevResource"
              @keydown.enter.prevent="selectHighlightedResource"
              @keydown.esc="showResourceSelector = false"
            />
            <div v-if="filteredResourceTypes.length === 0" class="dropdown-empty">
              No resources match "{{ resourceSearchQuery }}"
            </div>
            <div v-else class="dropdown-scroll-area">
              <div v-for="(resourceType, idx) in filteredResourceTypes" :key="resourceType"
                   @click="changeResourceType(resourceType)"
                   @mouseenter="highlightedResourceIndex = idx"
                   class="resource-option"
                   :class="{ selected: resourceType === currentResourceType, highlighted: idx === highlightedResourceIndex }">
                <span>{{ resourceType }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="toolbar-group" v-if="currentResourceType">
          <button @click="openElementSelector" class="btn-secondary">
            Add Element &#9662;
          </button>

          <div v-if="showElementSelector" class="element-selector-dropdown" @click.stop>
            <input
              ref="elementSearchInput"
              v-model="elementSearchQuery"
              class="dropdown-search"
              type="text"
              placeholder="Search elements..."
              @keydown.down.prevent="highlightNextElement"
              @keydown.up.prevent="highlightPrevElement"
              @keydown.enter.prevent="selectHighlightedElement"
              @keydown.esc="showElementSelector = false"
            />
            <div v-if="filteredElements.length === 0" class="dropdown-empty">
              No elements match "{{ elementSearchQuery }}"
            </div>
            <div v-else class="dropdown-scroll-area">
              <div v-for="(element, idx) in filteredElements" :key="element.path"
                   @click="addElement(element.path, element.type)"
                   @mouseenter="highlightedElementIndex = idx"
                   class="resource-option"
                   :class="{ 'has-binding': hasValueSetBinding(element.path), highlighted: idx === highlightedElementIndex }">
                <span>{{ element.name }}</span>
                <span class="type-badge">{{ element.type }}</span>

                <span v-if="hasValueSetBinding(element.path)" class="binding-indicator" title="Has ValueSet options">
                  &#128203;
                </span>

                <button v-if="hasNestedElements(element.path)" @click.stop="drillDown(element.path)" class="expand-btn">&#9654;</button>
              </div>
            </div>
          </div>
        </div>

        <div class="toolbar-group">
          <button @click="openResource" class="btn-secondary">Open Resource</button>
          <button v-if="currentResourceType" @click="exportResource" class="btn-secondary">Export</button>
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
                :default-expanded="true"
                :profile-sub-fields="element.profileSubFields"
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

    <!-- Open Resource Dialog -->
    <div v-if="showOpenDialog" class="modal-overlay" @click.self="showOpenDialog = false">
      <div class="modal-dialog open-resource-dialog">
        <h3>Open FHIR Resource</h3>

        <!-- Tabs -->
        <div class="open-tabs">
          <button
            @click="openDialogTab = 'paste'; openDialogError = ''"
            class="open-tab"
            :class="{ active: openDialogTab === 'paste' }"
          >
            Paste JSON
          </button>
          <button
            @click="openDialogTab = 'file'; openDialogError = ''"
            class="open-tab"
            :class="{ active: openDialogTab === 'file' }"
          >
            Upload File
          </button>
          <button
            @click="openDialogTab = 'url'; openDialogError = ''"
            class="open-tab"
            :class="{ active: openDialogTab === 'url' }"
          >
            From URL
          </button>
        </div>

        <!-- Tab: Paste JSON -->
        <div v-if="openDialogTab === 'paste'" class="open-tab-content">
          <p class="open-hint">Paste a FHIR resource JSON below:</p>
          <textarea
            v-model="pastedJson"
            class="open-paste-area"
            placeholder='{ "resourceType": "Patient", ... }'
            spellcheck="false"
          ></textarea>
          <div class="open-actions">
            <button @click="loadFromPaste" class="btn-primary">Load Resource</button>
            <button @click="showOpenDialog = false" class="btn-small">Cancel</button>
          </div>
        </div>

        <!-- Tab: Upload File -->
        <div v-if="openDialogTab === 'file'" class="open-tab-content">
          <p class="open-hint">Select a JSON file containing a FHIR resource:</p>
          <input type="file" accept=".json,application/json,application/fhir+json" @change="handleFileUpload" class="open-file-input" />
          <div class="open-actions">
            <button @click="showOpenDialog = false" class="btn-small">Cancel</button>
          </div>
        </div>

        <!-- Tab: From URL -->
        <div v-if="openDialogTab === 'url'" class="open-tab-content">
          <p class="open-hint">Enter the URL of a FHIR resource JSON:</p>
          <input
            v-model="resourceUrl"
            type="url"
            class="open-url-input"
            placeholder="https://hapi.fhir.org/baseR4/Patient/123"
            @keydown.enter.prevent="loadFromUrl"
          />
          <div class="open-actions">
            <button @click="loadFromUrl" class="btn-primary" :disabled="isUrlLoading">
              {{ isUrlLoading ? 'Loading...' : 'Fetch Resource' }}
            </button>
            <button @click="showOpenDialog = false" class="btn-small" :disabled="isUrlLoading">Cancel</button>
          </div>
        </div>

        <!-- Error within dialog -->
        <div v-if="openDialogError" class="open-error">
          {{ openDialogError }}
        </div>
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
  max-height: 400px;
  width: 320px;
  top: 100%;
  left: 0;
  animation: fadeIn 0.2s ease-in-out;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropdown-search {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid #e8e8e8;
  font-size: 13px;
  color: #333;
  background: #fafbfc;
  box-sizing: border-box;
  outline: none;
  border-radius: 8px 8px 0 0;
  flex-shrink: 0;
}

.dropdown-search::placeholder {
  color: #999;
  font-style: italic;
}

.dropdown-search:focus {
  background: #fff;
  border-bottom-color: #1976d2;
}

.dropdown-scroll-area {
  overflow-y: auto;
  flex: 1;
}

.dropdown-empty {
  padding: 16px 12px;
  color: #999;
  font-style: italic;
  text-align: center;
  font-size: 12px;
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

.resource-option.highlighted {
  background-color: #e3f2fd;
  color: #1976d2;
}

.resource-option.highlighted:hover {
  background-color: #1976d2;
  color: #ffffff;
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

/* Open Resource Dialog — wider for paste area */
.open-resource-dialog {
  max-width: 600px;
}

.open-tabs {
  display: flex;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 16px;
  gap: 0;
}

.open-tab {
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: #f5f5f5;
  color: #666;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease;
  border-radius: 6px 6px 0 0;
}

.open-tab:hover {
  background: #eaeaea;
  color: #333;
}

.open-tab.active {
  background: #ffffff;
  color: #1976d2;
  border-bottom: 3px solid #1976d2;
  font-weight: 600;
}

.open-tab-content {
  min-height: 120px;
}

.open-hint {
  font-size: 13px;
  color: #666;
  margin: 0 0 12px 0;
}

.open-paste-area {
  width: 100%;
  min-height: 200px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  resize: vertical;
  color: #333;
  background: #fafbfc;
  box-sizing: border-box;
  line-height: 1.5;
}

.open-paste-area:focus {
  outline: none;
  border-color: #1976d2;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
}

.open-paste-area::placeholder {
  color: #aaa;
  font-style: italic;
}

.open-file-input {
  width: 100%;
  padding: 8px;
  border: 1px dashed #bbb;
  border-radius: 6px;
  background: #fafbfc;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 4px;
}

.open-file-input:hover {
  border-color: #1976d2;
  background: #e3f2fd;
}

.open-url-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  box-sizing: border-box;
}

.open-url-input:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
}

.open-url-input::placeholder {
  color: #aaa;
  font-style: italic;
}

.open-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  justify-content: flex-end;
}

.open-error {
  margin-top: 12px;
  padding: 10px 12px;
  background: #ffebee;
  color: #c62828;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid #ef9a9a;
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