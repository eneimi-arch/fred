#!/usr/bin/env node
/**
 * split-profiles.js
 *
 * Splits the monolithic FHIR profile bundles into:
 *   - public/fhir_profiles/R4/manifest.json       (~5 KB - just resource names)
 *   - public/fhir_profiles/R4/resources/<Type>.json  (~10-200 KB each)
 *   - public/fhir_profiles/R4/types/<Type>.json      (~10-200 KB each)
 *
 * Usage:
 *   node scripts/split-profiles.js
 *
 * Run once after cloning the repo.
 */

const fs = require('fs');
const path = require('path');

// ---- CONFIG ----
const BASE_DIR = path.resolve(__dirname, '..');
const RESOURCES_SRC = path.join(BASE_DIR, 'fhir_profiles/R4/profiles-resources.json');
const TYPES_SRC = path.join(BASE_DIR, 'fhir_profiles/R4/profiles-types.json');
const OUTPUT_MANIFEST = path.join(BASE_DIR, 'public/fhir_profiles/R4/manifest.json');
const OUTPUT_RESOURCES = path.join(BASE_DIR, 'public/fhir_profiles/R4/resources');
const OUTPUT_TYPES = path.join(BASE_DIR, 'public/fhir_profiles/R4/types');

// ---- HELPERS ----
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function processBundle(filePath, outputDir) {
  console.log(`\nProcessing: ${path.basename(filePath)}`);
  const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
  console.log(`  Size: ${sizeMB} MB`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const bundle = JSON.parse(raw);
  const entries = bundle.entry || [];
  console.log(`  Entries: ${entries.length}`);

  const manifest = {};

  let kept = 0;
  for (const entry of entries) {
    const resource = entry.resource;
    if (!resource || resource.resourceType !== 'StructureDefinition') continue;

    const id = resource.id || resource.name || 'unknown';
    const sdType = resource.type || '';
    const kind = resource.kind || '';
    const name = resource.name || id;
    const url = resource.url || '';

    // Skip non-useful entries
    if (kind === 'logical' || kind === 'extension') continue;

    // Write individual file
    const outFile = path.join(outputDir, `${id}.json`);
    fs.writeFileSync(outFile, JSON.stringify(resource, null, 2));
    kept++;

    manifest[id] = { name, type: sdType, kind, url };
  }

  console.log(`  Written: ${kept} individual files`);
  return manifest;
}

// ---- MAIN ----
function main() {
  console.log('=== FHIR Profile Splitter ===');

  ensureDir(OUTPUT_RESOURCES);
  ensureDir(OUTPUT_TYPES);

  const resourcesManifest = processBundle(RESOURCES_SRC, OUTPUT_RESOURCES);
  const typesManifest = processBundle(TYPES_SRC, OUTPUT_TYPES);

  const manifest = {
    _generated: new Date().toISOString(),
    versions: ['R4'],
    R4: {
      resources: resourcesManifest,
      types: typesManifest,
      resourceTypes: Object.values(resourcesManifest)
        .filter((m) => m.kind === 'resource')
        .map((m) => m.name)
        .sort()
    }
  };

  ensureDir(path.dirname(OUTPUT_MANIFEST));
  fs.writeFileSync(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2));
  const manifestSize = (fs.statSync(OUTPUT_MANIFEST).size / 1024).toFixed(1);
  console.log(`\nManifest written: ${OUTPUT_MANIFEST} (${manifestSize} KB)`);
  console.log(`Available resource types: ${manifest.R4.resourceTypes.length}`);
  console.log('\nAfter verifying the split works, delete the large source bundles to save disk space.');
}

main();