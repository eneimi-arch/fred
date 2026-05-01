<template>
  <div class="complex-type-field" :class="`type-${elementTypeName}`">
    <!-- Header -->
    <div class="complex-type-header">
      <span class="type-icon">&#128230;</span>
      <span class="type-name">{{ elementTypeName }}</span>
      <span v-if="isArrayType" class="array-badge" title="Multiple values allowed">*</span>
      <button
        v-if="!isExpanded"
        @click="toggleExpand"
        class="btn-expand"
        title="Expand to edit fields"
      >
        &#9654; Edit Fields
      </button>
      <button
        v-else
        @click="toggleExpand"
        class="btn-collapse"
        title="Collapse"
      >
        &#9660; Collapse
      </button>
    </div>

    <!-- Expanded: Show sub-fields -->
    <div v-if="isExpanded" class="sub-fields-container">
      <!-- Array wrapper (for max > 1) -->
      <template v-if="isArrayType">
        <div
          v-for="(item, arrayIndex) in currentValue"
          :key="arrayIndex"
          class="array-item-wrapper"
        >
          <div class="array-item-header">
            <strong>{{ fieldName }} [{{ arrayIndex + 1 }}]</strong>
            <button
              @click="removeArrayItem(arrayIndex)"
              class="btn-remove"
              title="Remove this item"
            >
              &times;
            </button>
          </div>

          <!-- Render sub-fields for this array item -->
          <div class="sub-fields">
            <field-renderer
              v-for="subField in subFields"
              :key="subField.path + '-' + arrayIndex"
              :element="createSubFieldForArray(subField, arrayIndex)"
              :resource-data="currentValue[arrayIndex] || {}"
              :parent-path="`${elementPath}[${arrayIndex}]`"
              :depth="(depth || 0) + 1"
              @update="handleSubFieldUpdate($event, arrayIndex)"
            />
          </div>
        </div>

        <!-- Add button -->
        <button
          @click="addArrayItem"
          class="btn-add-item"
        >
          + Add {{ elementTypeName }}
        </button>
      </template>

      <!-- Single object -->
      <template v-else>
        <div class="sub-fields">
          <field-renderer
            v-for="subField in subFields"
            :key="subField.path"
            :element="subField"
            :resource-data="currentValue || {}"
            :parent-path="elementPath"
            :depth="(depth || 0) + 1"
            @update="handleSubFieldUpdate"
          />
        </div>
      </template>
    </div>

    <!-- Collapsed: Show summary -->
    <div v-else class="collapsed-summary">
      <span class="summary-text">{{ getSummaryText() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import FieldRenderer from './FieldRenderer.vue';
import { getComplexTypeDefinition } from '@/fhir/complexTypes';

// ============================================
// PROPS & EMITS
// ============================================

interface FhirTypeRef {
  code: string;
}

interface FhirElement {
  path?: string;
  name?: string;
  type?: string | FhirTypeRef[];
  max?: string;
  binding?: any;
  min?: number;
  id?: string;
  isArrayItem?: boolean;
}

const props = defineProps<{
  element: FhirElement;
  resourceData?: Record<string, any>;
  elementPath: string;
  depth?: number;
  defaultExpanded?: boolean;
}>();

const emit = defineEmits<{
  update: [event: { path: string; value: any }];
}>();

// ============================================
// REACTIVE STATE
// ============================================

const isExpanded = ref(!!props.defaultExpanded);

// Watch for external changes to defaultExpanded
watch(() => props.defaultExpanded, (newVal) => {
  isExpanded.value = !!newVal;
});

// ============================================
// COMPUTED PROPERTIES
// ============================================

// Extract the simple field name from the element path
const fieldName = computed<string>(() => {
  if (!props.element || !props.element.path) {
    return (props.element && props.element.name) || 'Field';
  }
  return props.element.path.split('.').pop() || 'Field';
});

// Get the primary type name (e.g., "HumanName", "Address")
// Handles both string type and FHIR array format
const elementTypeName = computed<string>(() => {
  const type = props.element ? props.element.type : undefined;

  if (!type) return 'Unknown';

  // Handle string format (from FredAdvanced selectedElements)
  if (typeof type === 'string') {
    return type;
  }

  // Handle FHIR format: array of type objects with code property
  if (Array.isArray(type) && type.length > 0) {
    const primitiveTypes = ['string', 'boolean', 'integer', 'decimal', 'uri', 'code', 'id'];
    // Return first non-primitive type
    const complexType = type.find(t =>
      t.code && !primitiveTypes.includes(t.code)
    );
    return complexType ? complexType.code : (type[0].code || 'Unknown');
  }

  return 'Unknown';
});

// Is this an array field (max > 1 or max = *)
const isArrayType = computed<boolean>(() => {
  return props.element.max === '*' ||
         (typeof props.element.max === 'string' && parseInt(props.element.max) > 1);
});

// Current value at this path
const currentValue = computed<any>(() => {
  return getValueAtPath(props.resourceData || {}, props.elementPath);
});

// Sub-fields definition based on complex type
const subFields = computed<FhirElement[]>(() => {
  return getComplexTypeDefinition(elementTypeName.value, props.elementPath) as FhirElement[];
});

// ============================================
// METHODS
// ============================================

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

// Navigate object path safely
function getValueAtPath(data: any, path: string): any {
  if (!data || !path) return undefined;

  const pathParts = path.split('.');
  let current = data;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (current === undefined || current === null) return undefined;

    // Parse array index like "name[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]];
      if (Array.isArray(current)) {
        current = current[parseInt(arrayMatch[2])];
      }
    } else {
      current = current[part];
    }
  }

  return current;
}

// Generate human-readable summary for collapsed view
function getSummaryText(): string {
  const val = currentValue.value;

  if (!val) return '(empty)';

  if (Array.isArray(val)) {
    return `${val.length} item(s)`;
  }

  // Type-specific summaries
  switch (elementTypeName.value) {
    case 'HumanName':
      return [val.given, val.family].filter(Boolean).join(' ') || '(empty)';

    case 'Address': {
      const parts = val.line ? val.line.join(', ') : '';
      return [parts, val.city].filter(Boolean).join(', ') || '(empty)';
    }

    case 'Identifier':
      return `${val.system || ''}: ${val.value || ''}`.trim() || '(empty)';

    case 'CodeableConcept':
      if (val.coding && val.coding.length) {
        return val.coding.map((c: any) => c.display || c.code).join(', ');
      }
      return val.text || '(empty)';

    case 'ContactPoint':
      return [val.system, val.value].filter(Boolean).join(': ') || '(empty)';

    case 'Coding':
      return [val.code, val.display].filter(Boolean).join(' - ') || '(empty)';

    case 'Period':
      if (val.start || val.end) {
        return `${val.start || '?'} - ${val.end || '?'}`;
      }
      return '(empty period)';

    case 'Quantity':
      return [val.value, val.unit].filter((v: any) => v !== undefined && v !== 0).join(' ') || '(empty)';

    case 'Reference':
      return val.reference || val.display || '(empty)';

    default:
      if (typeof val === 'object' && Object.keys(val).length > 0) {
        const nonEmpty = Object.keys(val).filter((k: string) => {
          const v = val[k];
          return v !== undefined && v !== null && v !== '';
        });
        return nonEmpty.length > 0 ? `{${nonEmpty.join(', ')}}` : '(empty)';
      }
      return '(complex object)';
  }
}

// Handle sub-field updates
function handleSubFieldUpdate(updateEvent: { path: string; value: any }, arrayIndex: number | null = null) {
  const { path, value } = updateEvent;

  let newValue: any;

  if (arrayIndex !== null) {
    newValue = [...(currentValue.value || [])];
    newValue[arrayIndex] = updateNestedObject(
      newValue[arrayIndex],
      path,
      value
    );
  } else {
    newValue = updateNestedObject(
      currentValue.value || {},
      path,
      value
    );
  }

  emit('update', {
    path: props.elementPath,
    value: newValue
  });
}

// Deep update nested object immutably
function updateNestedObject(obj: any, path: string, value: any): any {
  if (!obj || typeof obj !== 'object') {
    obj = {};
  }

  const parts = path.split('.');
  const result = Array.isArray(obj) ? [...obj] : { ...obj };

  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current[part] = { ...current[part] };
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;

  return result;
}

// Add new item to array
function addArrayItem() {
  const newItem = createEmptyObject();
  const newArray = [...(currentValue.value || []), newItem];

  emit('update', {
    path: props.elementPath,
    value: newArray
  });

  if (!isExpanded.value) {
    isExpanded.value = true;
  }
}

// Remove item from array
function removeArrayItem(index: number) {
  const newArray = [...(currentValue.value || [])];
  newArray.splice(index, 1);

  emit('update', {
    path: props.elementPath,
    value: newArray
  });
}

// Create empty object template for complex type
function createEmptyObject(): Record<string, any> {
  const templates: Record<string, Record<string, any>> = {
    'HumanName': { use: 'official', text: '', family: '', given: [], prefix: [], suffix: [] },
    'Address': { use: 'home', text: '', line: [], city: '', district: '', state: '', postalCode: '', country: '' },
    'Identifier': { use: 'usual', type: {}, system: '', value: '', period: {} },
    'CodeableConcept': { coding: [], text: '' },
    'Coding': { system: '', version: '', code: '', display: '', userSelected: false },
    'ContactPoint': { system: '', value: '', use: 'home', rank: 1, period: {} },
    'Attachment': { contentType: '', language: '', data: '', url: '', size: 0, hash: '', title: '', creation: '' },
    'Quantity': { value: 0, comparator: '', unit: '', system: '', code: '' },
    'Range': { low: {}, high: {} },
    'Period': { start: '', end: '' },
    'Timing': { event: [], repeat: {}, code: {} },
    'Annotation': { authorReference: {}, authorString: '', time: '', text: '' },
    'Reference': { reference: '', type: '', identifier: {}, display: '' },
    'Signature': { type: [], when: '', who: {}, whoUri: '', format: '', data: '' }
  };

  return templates[elementTypeName.value] || {};
}

// Create sub-field config for array items
function createSubFieldForArray(subField: FhirElement, arrayIndex: number): FhirElement {
  return {
    ...subField,
    id: subField.id ? subField.id.replace(/\[\d+\]/, `[${arrayIndex}]`) : undefined,
    path: subField.path ? subField.path.split('.').pop() || subField.path : subField.path,
    isArrayItem: true
  };
}
</script>

<style scoped>
.complex-type-field {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
  background: #fafafa;
}

.complex-type-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.type-icon {
  font-size: 18px;
}

.type-name {
  font-weight: 600;
  color: #1976d2;
  font-size: 14px;
}

.array-badge {
  font-size: 12px;
  font-weight: bold;
  color: #e65100;
  background: #fff3e0;
  padding: 1px 6px;
  border-radius: 8px;
}

.btn-expand,
.btn-collapse {
  margin-left: auto;
  padding: 4px 12px;
  border: 1px solid #1976d2;
  background: white;
  color: #1976d2;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-expand:hover,
.btn-collapse:hover {
  background: #e3f2fd;
}

.sub-fields-container {
  margin-top: 12px;
}

.array-item-wrapper {
  border: 1px dashed #ccc;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
  background: white;
}

.array-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}

.btn-remove {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.btn-remove:hover {
  background: #ffcdd2;
}

.btn-add-item {
  width: 100%;
  padding: 8px;
  border: 2px dashed #1976d2;
  background: white;
  color: #1976d2;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 8px;
  font-weight: 500;
}

.btn-add-item:hover {
  background: #e3f2fd;
}

.collapsed-summary {
  padding: 8px;
  background: white;
  border-radius: 4px;
  font-style: italic;
  color: #666;
  font-size: 13px;
}

.sub-fields {
  margin-left: 16px;
}
</style>