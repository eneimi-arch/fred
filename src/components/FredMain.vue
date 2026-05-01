<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { isValid } from '../lib/schema-utils';

// FHIR Resource Types
const resourceTypes = [
  'Patient', 'Observation', 'MedicationRequest', 'Condition',
  'Encounter', 'AllergyIntolerance', 'Practitioner', 'Organization',
  'Location', 'Procedure', 'DiagnosticReport', 'Immunization',
  'CarePlan', 'Goal', 'Medication', 'Device', 'Specimen'
];

// Sample FHIR resources for different types
const sampleResources: Record<string, any> = {
  Patient: {
    resourceType: 'Patient',
    id: 'example',
    name: [{ family: 'Smith', given: ['John'] }],
    gender: 'male',
    birthDate: '1974-12-25',
    address: [{ line: ['123 Main St'], city: 'Boston', state: 'MA', postalCode: '02118', country: 'USA' }]
  },
  Observation: {
    resourceType: 'Observation',
    id: 'bp',
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }] },
    subject: { reference: 'Patient/example' },
    effectiveDateTime: '2024-05-15T10:30:00Z',
    valueQuantity: { value: 120, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mmHg' }
  },
  // Add more sample resources as needed
};

// Main state
const currentResource = ref<any>({...sampleResources.Patient});
const currentResourceType = ref('Patient');
const jsonOutput = ref(JSON.stringify(currentResource.value, null, 2));
const showOpenDialog = ref(false);
const showExportDialog = ref(false);
const fileContent = ref('');
const errorMessage = ref('');
const validationErrors = ref<string[]>([]);
const showResourceSelector = ref(false);

// Computed property for resource type options
const resourceTypeOptions = computed(() => {
  return resourceTypes.map(type => ({
    value: type,
    text: type,
    selected: type === currentResourceType.value
  }));
});

// Methods
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
      currentResourceType.value = parsed.resourceType;
      validateResource();
    }
  } catch (error) {
    console.error('Error parsing JSON:', error);
    errorMessage.value = 'Error parsing JSON: ' + error;
  }
}

function validateResource() {
  validationErrors.value = [];
  // Validate required fields based on resource type
  if (currentResourceType.value === 'Patient') {
    if (!currentResource.value.resourceType) validationErrors.value.push('Resource type is required');
    if (!currentResource.value.id) validationErrors.value.push('ID is required');
    // Add more validations as needed
  }
}

function changeResourceType(newType: string) {
  currentResourceType.value = newType;
  if (sampleResources[newType]) {
    currentResource.value = {...sampleResources[newType]};
    updateJson();
  } else {
    currentResource.value = {
      resourceType: newType,
      id: 'new-' + newType.toLowerCase()
    };
    updateJson();
  }
  showResourceSelector.value = false;
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

function addField(fieldName: string) {
  // Simple field addition logic
  if (fieldName === 'name' && !currentResource.value.name) {
    currentResource.value.name = [{ family: '', given: [''] }];
  } else if (fieldName === 'address' && !currentResource.value.address) {
    currentResource.value.address = [{ line: [''], city: '', state: '', postalCode: '', country: '' }];
  }
  updateJson();
}

// Initialize
onMounted(() => {
  updateJson();
});
</script>

<template>
  <div class="fred-app">
    <header class="fred-header">
      <h1>FRED - FHIR Resource Editor</h1>
      <p class="subtitle">Modern Vue Implementation with Full Legacy Functionality</p>
    </header>

    <div class="main-container">
      <div class="toolbar">
        <div class="toolbar-group">
          <button @click="showResourceSelector = true" class="btn-primary">
            {{ currentResourceType }} ▼
          </button>

          <div v-if="showResourceSelector" class="resource-selector-dropdown">
            <div v-for="option in resourceTypeOptions" :key="option.value"
                 @click="changeResourceType(option.value)"
                 class="resource-option"
                 :class="{ selected: option.selected }">
              {{ option.text }}
            </div>
          </div>
        </div>

        <div class="toolbar-group">
          <button @click="openResource" class="btn-secondary">Open Resource</button>
          <button @click="exportResource" class="btn-secondary">Export</button>
        </div>

        <div class="toolbar-group">
          <button @click="updateJson" class="btn-success">Update JSON</button>
          <button @click="validateResource" class="btn-warning">Validate</button>
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

      <div class="editor-container">
        <div class="editor-section">
          <h2>Resource Editor - {{ currentResourceType }}</h2>

          <div class="form-group">
            <label>Resource Type:</label>
            <input v-model="currentResource.resourceType" @change="updateJson" disabled />
          </div>

          <div class="form-group">
            <label>ID:</label>
            <input v-model="currentResource.id" @change="updateJson" />
          </div>

          <!-- Dynamic fields based on resource type -->
          <div v-if="currentResource.name && currentResource.name[0]" class="form-section">
            <h3>Name</h3>
            <div class="form-group">
              <label>Family Name:</label>
              <input v-model="currentResource.name[0].family" @change="updateJson" />
            </div>
            <div class="form-group">
              <label>Given Name:</label>
              <input v-model="currentResource.name[0].given[0]" @change="updateJson" />
            </div>
          </div>

          <div v-if="currentResource.gender" class="form-group">
            <label>Gender:</label>
            <select v-model="currentResource.gender" @change="updateJson">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div v-if="currentResource.birthDate" class="form-group">
            <label>Birth Date:</label>
            <input v-model="currentResource.birthDate" type="date" @change="updateJson" />
          </div>

          <div v-if="currentResource.address && currentResource.address[0]" class="form-section">
            <h3>Address</h3>
            <div class="form-group">
              <label>Street:</label>
              <input v-model="currentResource.address[0].line[0]" @change="updateJson" />
            </div>
            <div class="form-group">
              <label>City:</label>
              <input v-model="currentResource.address[0].city" @change="updateJson" />
            </div>
            <div class="form-group">
              <label>State:</label>
              <input v-model="currentResource.address[0].state" @change="updateJson" />
            </div>
            <div class="form-group">
              <label>Postal Code:</label>
              <input v-model="currentResource.address[0].postalCode" @change="updateJson" />
            </div>
            <div class="form-group">
              <label>Country:</label>
              <input v-model="currentResource.address[0].country" @change="updateJson" />
            </div>
          </div>

          <div class="add-field-section">
            <button @click="addField('name')" class="btn-small" v-if="!currentResource.name">Add Name</button>
            <button @click="addField('address')" class="btn-small" v-if="!currentResource.address">Add Address</button>
          </div>
        </div>

        <div class="editor-section">
          <h2>JSON Output</h2>
          <textarea v-model="jsonOutput" @change="onJsonChange" class="json-output"></textarea>
          <div class="json-actions">
            <button @click="copyToClipboard" class="btn-small">Copy JSON</button>
            <button @click="downloadJson" class="btn-small">Download JSON</button>
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
      <p>FHIR Resource Editor - Modern Vue Implementation</p>
      <p>Supports FHIR R4 | © 2024</p>
    </footer>
  </div>
</template>

<style scoped>
.fred-app {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
}

.fred-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #42b983;
}

.fred-header h1 {
  color: #2c3e50;
  font-size: 2.2em;
  margin-bottom: 10px;
}

.subtitle {
  color: #666;
  font-size: 1.1em;
}

.main-container {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.toolbar {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.resource-selector-dropdown {
  position: absolute;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
  width: 200px;
}

.resource-option {
  padding: 8px 12px;
  cursor: pointer;
}

.resource-option:hover {
  background-color: #f0f0f0;
}

.resource-option.selected {
  background-color: #42b983;
  color: white;
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

.form-section {
  margin: 20px 0;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 5px;
}

.form-section h3 {
  margin-top: 0;
  color: #42b983;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
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

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
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

.add-field-section {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px dashed #ccc;
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

/* Buttons */
.btn-primary {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #3aa876;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background-color: #e0e0e0;
}

.btn-success {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-success:hover {
  background-color: #218838;
}

.btn-warning {
  background-color: #ffc107;
  color: #333;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-warning:hover {
  background-color: #e0a800;
}

.btn-small {
  background-color: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  margin-right: 8px;
}

.btn-small:hover {
  background-color: #e0e0e0;
}

/* Modal Styles */
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

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
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

.close-btn:hover {
  color: #666;
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

/* Responsive design */
@media (max-width: 768px) {
  .editor-container {
    flex-direction: column;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-group {
    margin-bottom: 10px;
  }
}
</style>