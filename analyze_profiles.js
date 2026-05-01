const fs = require('fs');
const data = JSON.parse(fs.readFileSync('fhir_profiles/R4/profiles-resources.json'));
console.log('Entry count:', data.entry?.length);
if(data.entry) { 
  const patient = data.entry.find(e => e.resource?.type === 'Patient');
  if(patient) { 
    console.log('Patient element count:', patient.resource?.snapshot?.element?.length);
    const nameEls = patient.resource.snapshot.element.filter(e => e.path?.startsWith('Patient.name')).slice(0, 15);
    console.log('\nPatient.name elements:');
    nameEls.forEach(e => console.log(e.path, e.type?.[0]?.code));
    
    // Check for gender binding
    const genderEl = patient.resource.snapshot.element.find(e => e.path === 'Patient.gender');
    if(genderEl) {
      console.log('\nPatient.gender binding:', JSON.stringify(genderEl.binding, null, 2));
    }
  } 
}</arg_value>
<task_progress>
- [x] Analyze current FredAdvanced.vue implementation
- [ ] Fix nested element display (Patient.name, etc.)
- [ ] Implement ValueSet binding detection
- [ ] Add ValueSet option loading
- [ ] Optimize profile file loading
- [ ] Test fixed functionality
</task_progress>
</tool_call>