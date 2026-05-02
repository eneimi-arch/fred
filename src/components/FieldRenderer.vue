<template>
  <div class="field-renderer" :class="{ 'is-complex': checkIsComplex, 'is-array': isArrayField }">

    <!-- Array of complex type items (e.g. coding[] is array of Coding) -->
    <template v-if="isArrayField && checkIsComplex">
      <div class="array-complex-items">
        <div
          v-for="(item, index) in arrayValue"
          :key="index"
          class="array-complex-item"
        >
          <div class="array-item-header">
            <span class="array-item-label">{{ element.name || fieldName }} [{{ index + 1 }}]</span>
            <button @click="removeComplexArrayItem(index)" class="btn-remove-item" title="Remove">&times;</button>
          </div>
          <complex-type-field
            :element="singleItemElement"
            :resource-data="arrayValue[index] || {}"
            :element-path="''"
            :depth="(depth || 0) + 1"
            :default-expanded="true"
            @update="handleComplexArrayItemUpdate($event, index)"
          />
        </div>
        <button @click="addComplexArrayItem" class="btn-add-item">+ Add {{ element.name || fieldName }}</button>
      </div>
    </template>

    <!-- Array of primitive values: render multiple inputs -->
    <template v-else-if="isArrayField && checkIsPrimitive">
      <div class="field-label-row"><span class="field-label">{{ element.name || fieldName }}</span></div>
      <div class="array-items">
        <div v-for="(item, index) in arrayValue" :key="index" class="array-item">
          <div class="array-item-header">
            <span class="array-item-label">{{ element.name || fieldName }} [{{ index + 1 }}]</span>
            <button @click="removeArrayItem(index)" class="btn-remove-item" title="Remove">&times;</button>
          </div>
          <input
            :type="getInputType(firstTypeCode)"
            :value="item"
            @input="updateArrayItem(index, ($event.target as HTMLInputElement).value)"
            :placeholder="'Enter ' + (element.name || fieldName)"
            class="field-input"
          />
        </div>
        <button @click="addArrayItem" class="btn-add-item">+ Add {{ element.name || fieldName }}</button>
      </div>
    </template>

    <!-- Complex type field (single): recurse with ComplexTypeField -->
    <template v-else-if="checkIsComplex">
      <complex-type-field
        :element="element"
        :resource-data="resourceData"
        :element-path="resolvedPath"
        :depth="(depth || 0) + 1"
        :default-expanded="true"
        @update="emitUpdate"
      />
    </template>

    <!-- Bound element with ValueSet -->
    <template v-else-if="hasBinding">
      <div class="field-label-row"><span class="field-label">{{ element.name || fieldName }}</span></div>
      <div class="bound-field">
        <select
          :value="fieldValue"
          @change="emitUpdate(($event.target as HTMLSelectElement).value)"
          class="field-select"
        >
          <option value="">-- Select --</option>
          <option
            v-for="option in getBindingOptions()"
            :key="option.code"
            :value="option.code"
          >
            {{ option.display }}
          </option>
          <option value="__custom__">Enter custom value...</option>
        </select>
        <input
          v-if="fieldValue === '__custom__' || !getBindingOptions().length"
          type="text"
          :value="fieldValue === '__custom__' ? '' : fieldValue"
          @input="emitUpdate(($event.target as HTMLInputElement).value)"
          :placeholder="'Enter ' + (element.name || fieldName)"
          class="field-input custom-value-input"
        />
        <small v-if="bindingDescription" class="binding-description">
          {{ bindingDescription }}
        </small>
      </div>
    </template>

    <!-- Boolean field: checkbox -->
    <template v-else-if="firstTypeCode === 'boolean'">
      <div class="field-label-row"><span class="field-label">{{ element.name || fieldName }}</span></div>
      <label class="boolean-field">
        <input
          type="checkbox"
          :checked="!!fieldValue"
          @change="emitUpdate(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ fieldValue ? 'Yes' : 'No' }}</span>
      </label>
    </template>

    <!-- Default: simple text/number input -->
    <template v-else>
      <div class="field-label-row"><span class="field-label">{{ element.name || fieldName }}</span></div>
      <input
        :type="getInputType(firstTypeCode)"
        :value="fieldValue"
        @input="emitUpdate(($event.target as HTMLInputElement).value)"
        :placeholder="element.shortDescription || 'Enter ' + (element.name || fieldName)"
        class="field-input"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isComplexType, isPrimitiveType } from '@/fhir/complexTypes';
import ComplexTypeField from './ComplexTypeField.vue';

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
  binding?: {
    strength?: string;
    valueSet?: string;
    description?: string;
  };
  shortDescription?: string;
}

const props = defineProps<{
  element: FhirElement;
  resourceData?: Record<string, any>;
  parentPath?: string;
  depth?: number;
}>();

const emit = defineEmits<{
  update: [event: { path: string; value: any }];
}>();

// ============================================
// COMPUTED PROPERTIES
// ============================================

// Extract the simple field name from the element path
const fieldName = computed<string>(() => {
  if (!props.element || !props.element.path) return '';
  return props.element.path.split('.').pop() || '';
});

// Full resolved path including parent context
const resolvedPath = computed<string>(() => {
  const base = props.parentPath || '';
  const name = fieldName.value;
  return base ? `${base}.${name}` : name;
});

// Get the first type code safely
const firstTypeCode = computed<string>(() => {
  const el = props.element;
  if (!el) return '';
  const type = el.type;
  if (typeof type === 'string') return type;
  if (Array.isArray(type) && type.length > 0 && type[0].code) return type[0].code;
  return '';
});

// Check if first type is complex
const checkIsComplex = computed<boolean>(() => {
  return isComplexType(firstTypeCode.value);
});

// Check if first type is primitive
const checkIsPrimitive = computed<boolean>(() => {
  return isPrimitiveType(firstTypeCode.value);
});

// Whether this field allows multiple values (max > 1 or *)
const isArrayField = computed<boolean>(() => {
  const max = props.element ? props.element.max : undefined;
  return max === '*' ||
         (typeof max === 'string' && parseInt(max) > 1);
});

// Element with max='1' for rendering individual array items as single objects
// (prevents ComplexTypeField from entering array mode for each item)
const singleItemElement = computed<FhirElement>(() => ({
  ...props.element,
  max: '1'
}));

// Get the current value from the parent resource data
const fieldValue = computed<any>(() => {
  if (!props.resourceData || !fieldName.value) return '';
  return props.resourceData[fieldName.value];
});

// Get value as array for array fields
const arrayValue = computed<any[]>(() => {
  const val = fieldValue.value;
  return Array.isArray(val) ? val : (val ? [val] : []);
});

// Check if element has ValueSet binding
const hasBinding = computed<boolean>(() => {
  const binding = props.element ? props.element.binding : undefined;
  if (!binding) return false;
  return ['required', 'extensible', 'preferred'].includes(binding.strength || '');
});

// Get binding description
const bindingDescription = computed<string>(() => {
  const binding = props.element ? props.element.binding : undefined;
  return (binding && binding.description) || '';
});

// ============================================
// METHODS
// ============================================

// Get appropriate HTML input type for a FHIR type
function getInputType(fhirType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'text',
    'code': 'text',
    'uri': 'url',
    'url': 'url',
    'canonical': 'url',
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
    'oid': 'text'
  };
  return typeMap[fhirType] || 'text';
}

// Emit update event with new value
function emitUpdate(value: any) {
  emit('update', {
    path: fieldName.value,
    value: value
  });
}

// Get hardcoded binding options for common ValueSets
function getBindingOptions(): Array<{ code: string; display: string }> {
  const binding = props.element ? props.element.binding : undefined;
  if (!binding || !binding.valueSet) return [];

  const valueSetUrl = binding.valueSet;
  const optionsMap: Record<string, Array<{ code: string; display: string }>> = {
    'http://hl7.org/fhir/ValueSet/name-use': [
      { code: 'usual', display: 'Usual' },
      { code: 'official', display: 'Official' },
      { code: 'temp', display: 'Temp' },
      { code: 'nickname', display: 'Nickname' },
      { code: 'anonymous', display: 'Anonymous' },
      { code: 'old', display: 'Old' },
      { code: 'maiden', display: 'Maiden Name' }
    ],
    'http://hl7.org/fhir/ValueSet/address-use': [
      { code: 'home', display: 'Home' },
      { code: 'work', display: 'Work' },
      { code: 'temp', display: 'Temporary' },
      { code: 'old', display: 'Old/Incorrect' },
      { code: 'billing', display: 'Billing' }
    ],
    'http://hl7.org/fhir/ValueSet/address-type': [
      { code: 'postal', display: 'Postal' },
      { code: 'physical', display: 'Physical' },
      { code: 'both', display: 'Both' }
    ],
    'http://hl7.org/fhir/ValueSet/identifier-use': [
      { code: 'usual', display: 'Usual' },
      { code: 'official', display: 'Official' },
      { code: 'temp', display: 'Temp' },
      { code: 'secondary', display: 'Secondary' },
      { code: 'old', display: 'Old' }
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
    'http://hl7.org/fhir/ValueSet/contact-point-use': [
      { code: 'home', display: 'Home' },
      { code: 'work', display: 'Work' },
      { code: 'temp', display: 'Temp' },
      { code: 'old', display: 'Old' },
      { code: 'mobile', display: 'Mobile' }
    ]
  };

  return optionsMap[valueSetUrl] || [];
}

// Update a specific array item value
function updateArrayItem(index: number, newValue: any) {
  const newArr = [...arrayValue.value];
  newArr[index] = newValue;
  emit('update', {
    path: fieldName.value,
    value: newArr
  });
}

// Add a new empty item to array
function addArrayItem() {
  const newArr = [...arrayValue.value, ''];
  emit('update', {
    path: fieldName.value,
    value: newArr
  });
}

// Remove an item from primitive array
function removeArrayItem(index: number) {
  const newArr = [...arrayValue.value];
  newArr.splice(index, 1);
  emit('update', {
    path: fieldName.value,
    value: newArr
  });
}

// ============================================
// ARRAY OF COMPLEX TYPE METHODS
// (e.g., coding[] where each item is a Coding object)
// ============================================

// Empty templates for complex array items
function createEmptyComplexItem(): Record<string, any> {
  const templates: Record<string, Record<string, any>> = {
    'Coding': { system: '', version: '', code: '', display: '', userSelected: false },
    'CodeableConcept': { coding: [], text: '' },
    'HumanName': { use: 'official', text: '', family: '', given: [], prefix: [], suffix: [] },
    'Identifier': { use: 'usual', type: {}, system: '', value: '', period: {} },
    'ContactPoint': { system: '', value: '', use: 'home', rank: 1, period: {} },
    'Address': { use: 'home', text: '', line: [], city: '', district: '', state: '', postalCode: '', country: '' },
    'Reference': { reference: '', type: '', identifier: {}, display: '' },
    'Quantity': { value: 0, comparator: '', unit: '', system: '', code: '' },
    'Period': { start: '', end: '' },
    'Attachment': { contentType: '', language: '', data: '', url: '', size: 0, hash: '', title: '', creation: '' }
  };
  return templates[firstTypeCode.value] || {};
}

// Add a new empty complex item to the array
function addComplexArrayItem() {
  const newArr = [...arrayValue.value, createEmptyComplexItem()];
  emit('update', {
    path: fieldName.value,
    value: newArr
  });
}

// Remove a complex item from the array
function removeComplexArrayItem(index: number) {
  const newArr = [...arrayValue.value];
  newArr.splice(index, 1);
  emit('update', {
    path: fieldName.value,
    value: newArr
  });
}

// Handle update from a ComplexTypeField for an individual array item.
// ComplexTypeField emits { path: fieldName, value: updatedItem }
// We splice the updated item back into the array.
function handleComplexArrayItemUpdate(updateEvent: { path: string; value: any }, arrayIndex: number) {
  const newArr = [...arrayValue.value];
  newArr[arrayIndex] = updateEvent.value;
  emit('update', {
    path: fieldName.value,
    value: newArr
  });
}
</script>

<style scoped>
.field-renderer {
  margin: 6px 0;
  padding: 4px 0;
}

.field-renderer.is-complex {
  background: #fafafa;
  border-radius: 4px;
  padding: 6px 10px;
}

.field-label-row {
  margin-bottom: 3px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #555;
  text-transform: lowercase;
  display: inline-block;
}

.field-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  color: #333;
}

.field-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.15);
}

.field-select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  color: #333;
  background: white;
  cursor: pointer;
}

.field-select:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.15);
}

.boolean-field {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.boolean-field input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.array-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.array-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.array-complex-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.array-complex-item {
  border: 1px dashed #bbb;
  border-radius: 6px;
  padding: 8px;
  background: white;
}

.array-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 120px;
  margin-bottom: 6px;
}

.array-item-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.btn-remove-item {
  background: none;
  border: none;
  color: #c62828;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  line-height: 1;
}

.btn-remove-item:hover {
  background: #ffebee;
  border-radius: 50%;
}

.btn-add-item {
  background: none;
  border: 1px dashed #42b983;
  color: #42b983;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  align-self: flex-start;
}

.btn-add-item:hover {
  background: #e8f5e9;
}

.bound-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.binding-description {
  color: #888;
  font-size: 11px;
  font-style: italic;
}

.custom-value-input {
  margin-top: 4px;
  border-color: #42b983;
}
</style>