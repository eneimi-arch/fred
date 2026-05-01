/**
 * FHIR ValueSet Loader Service
 *
 * Statically imports the pre-built ValueSet index.
 * Options are available synchronously from the moment the module loads — no fetch, no async.
 *
 * Data source: src/fhir/valueSetIndex.json
 * (generated from the FHIR R4 valuesets.json Bundle)
 *
 * Usage:
 *   import valueSetLoader from '@/services/valueSetLoader';
 *   const options = valueSetLoader.getOptions('http://hl7.org/fhir/ValueSet/administrative-gender');
 *   // => [{code: 'male', display: 'Male'}, {code: 'female', display: 'Female'}, ...]
 */

// Vite resolves this at build/dev time — bundled into the app, no network request
import indexData from '@/fhir/valueSetIndex.json';

const valueSets = (indexData && indexData.valueSets) || {};
const valueSetsById = (indexData && indexData.valueSetsById) || {};

console.log(`ValueSet index loaded: ${Object.keys(valueSets).length} ValueSets by URL, ${Object.keys(valueSetsById).length} by ID`);

/**
 * Extract the ValueSet id from a binding URL.
 * e.g. "http://hl7.org/fhir/ValueSet/administrative-gender" → "administrative-gender"
 */
function _extractId(url) {
  if (!url) return null;
  const cleanUrl = url.split('?')[0].split('#')[0].replace(/\/$/, '');
  const parts = cleanUrl.split('/');
  const id = parts[parts.length - 1];
  return id.replace(/\.json$/i, '') || null;
}

/**
 * Get ValueSet options by binding URL (always synchronous).
 *
 * Lookup order:
 *   1. Exact URL match (e.g. "http://hl7.org/fhir/ValueSet/administrative-gender")
 *   2. URL without version suffix (e.g. strip "|4.0.1")
 *   3. By ValueSet ID (last path segment)
 *
 * @param {string} bindingUrl
 * @returns {Array<{code: string, display: string}>}
 */
function getOptions(bindingUrl) {
  if (!bindingUrl) return [];

  // 1. Exact URL match
  let results = valueSets[bindingUrl];

  // 2. Strip version suffix if present
  if (!results && bindingUrl.includes('|')) {
    results = valueSets[bindingUrl.split('|')[0]];
  }

  // 3. Fallback by ValueSet ID
  if (!results) {
    const vsId = _extractId(bindingUrl);
    if (vsId) {
      results = valueSetsById[vsId];
    }
  }

  return results || [];
}

export default {
  getOptions,
  getOptionsSync: getOptions,       // alias
  getValueSetOptions: (url) => getOptions(url), // async-compatible alias (resolves immediately)
  isReady: () => true,              // always ready — data is static
  initialize: async () => {},        // no-op for API compatibility
  getStats: () => ({
    ready: true,
    source: 'static-import',
    totalValueSets: Object.keys(valueSets).length,
    totalById: Object.keys(valueSetsById).length
  })
};