<script setup lang="ts">
import { ref } from 'vue';

const fhirResource = ref({
  resourceType: 'Patient',
  id: 'example',
  name: [{
    family: 'Smith',
    given: ['John']
  }],
  gender: 'male',
  birthDate: '1974-12-25'
});

const jsonOutput = ref(JSON.stringify(fhirResource.value, null, 2));

function updateJson() {
  try {
    jsonOutput.value = JSON.stringify(fhirResource.value, null, 2);
  } catch (error) {
    console.error('Error updating JSON:', error);
  }
}

function onJsonChange() {
  try {
    const parsed = JSON.parse(jsonOutput.value);
    if (parsed.resourceType) {
      fhirResource.value = parsed;
    }
  } catch (error) {
    console.error('Error parsing JSON:', error);
  }
}
</script>

<template>
  <div class="fhir-editor">
    <h1>FRED - FHIR Resource Editor</h1>

    <div class="editor-container">
      <div class="editor-section">
        <h2>Resource Editor</h2>
        <div class="form-group">
          <label>Resource Type:</label>
          <input v-model="fhirResource.resourceType" @change="updateJson" />
        </div>

        <div class="form-group">
          <label>ID:</label>
          <input v-model="fhirResource.id" @change="updateJson" />
        </div>

        <div class="form-group" v-if="fhirResource.name && fhirResource.name[0]">
          <label>Name:</label>
          <input v-model="fhirResource.name[0].family" placeholder="Family name" @change="updateJson" />
          <input v-model="fhirResource.name[0].given[0]" placeholder="Given name" @change="updateJson" />
        </div>

        <div class="form-group" v-if="fhirResource.gender">
          <label>Gender:</label>
          <select v-model="fhirResource.gender" @change="updateJson">
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div class="form-group" v-if="fhirResource.birthDate">
          <label>Birth Date:</label>
          <input v-model="fhirResource.birthDate" type="date" @change="updateJson" />
        </div>
      </div>

      <div class="editor-section">
        <h2>JSON Output</h2>
        <textarea v-model="jsonOutput" @change="onJsonChange" class="json-output"></textarea>
        <button @click="updateJson" class="update-btn">Update JSON</button>
      </div>
    </div>

    <div class="footer">
      <p>FHIR Resource Editor - Modern Vue Implementation</p>
    </div>
  </div>
</template>

<style scoped>
.fhir-editor {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
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
  background-color: #f9f9f9;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input, .form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.json-output {
  width: 100%;
  height: 400px;
  font-family: monospace;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical;
  background-color: #f5f5f5;
}

.update-btn {
  margin-top: 10px;
  padding: 8px 15px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.update-btn:hover {
  background-color: #3aa876;
}

.footer {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  text-align: center;
  color: #666;
  font-size: 14px;
}

h1 {
  color: #2c3e50;
  text-align: center;
}

h2 {
  color: #34495e;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
</style>