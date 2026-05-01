// Minimal test to isolate the exact issue
console.log('Starting test...');

try {
  // Test just the import
  console.log('Importing schema-utils...');
  const schemaUtils = require('./schema-utils');
  console.log('Import successful:', Object.keys(schemaUtils));
  
  // Test just the isValid function
  console.log('Testing isValid...');
  const result = schemaUtils.isValid('string', 'test');
  console.log('isValid result:', result);
  
} catch (error) {
  console.error('Error:', error);
  console.error('Stack:', error.stack);
}