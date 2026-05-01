<template>
  <div class="field-renderer" :class="{ 'is-complex': checkIsComplex, 'is-array': isArrayField }">

    <!-- Array field: render multiple items -->
    <template v-if="isArrayField && checkIsPrimitive">
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

    <!-- Complex type field: render as expandable -->
    <template v-else-if="checkIsComplex">
      <div class="complex-field-preview">
        <span class="complex-label">{{ element.name || fieldName }}</span>
        <span class="type-tag">{{ firstTypeCode }}</span>
        <span class="complex-preview-text">{{ getComplexPreview() }}</span>
      </div>
    </template>

    <!-- Bound element with ValueSet -->
    <template v-else-if="hasBinding">
      <div class="bound-field">
        <select
          :value="fieldValue"
          @change="emitUpdate(($event.target as HTMLSelectElement).value)"
          class="field-select"
        >
          <option value="">-- Select {{ element.name || fieldName }} --</option>
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

// Get the first type code safely (replaces all element?.type?.[0]?.code)
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

// Get a human-readable preview for complex type values
function getComplexPreview(): string {
  const val = fieldValue.value;
  if (!val) return '(empty)';

  const typeName = firstTypeCode.value;

  switch (typeName) {
    case 'Period':
      if (val.start || val.end) {
        return `${val.start || '?'} - ${val.end || '?'}`;
      }
      return '(empty period)';

    case 'Coding':
      return [val.system, val.code, val.display].filter(Boolean).join(' | ') || '(empty)';

    case 'CodeableConcept':
      if (val.coding && val.coding.length) {
        return val.coding.map((c: any) => c.display || c.code).join(', ');
      }
      return val.text || '(empty)';

    default:
      if (typeof val === 'object' && Object.keys(val).length > 0) {
        const keys = Object.keys(val).filter((k: string) => val[k]);
        return keys.length > 0 ? `{${keys.join(', ')}}` : '(empty)';
      }
      return '(empty)';
  }
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

// Remove an item from array
function removeArrayItem(index: number) {
  const newArr = [...arrayValue.value];
  newArr.splice(index, 1);
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

.complex-field-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.complex-label {
  font-weight: 600;
  color: #2c3e50;
}

.type-tag {
  font-size: 10px;
  padding: 1px 5px;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 8px;
}

.complex-preview-text {
  color: #888;
  font-style: italic;
  margin-left: auto;
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

.array-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 120px;
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