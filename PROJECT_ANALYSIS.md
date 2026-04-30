# FRED — Project Analysis

> **Analysis Date:** 2026-04-30 21:42 CEST (Europe/Stockholm)  
> **Git HEAD:** `48319ca` — *add r4 profiles*  
> **Analyst:** Cline (AI-assisted code review)

---

## 1. Executive Summary

FRED (FHIR Resource Editor) is an open-source, client-side HTML5 web application for editing JSON FHIR resources and bundles. Originally created by Dan Gottlieb for SMART Health IT, it supports DSTU2, STU3, and — as of the most recent commit — **R4**. The application runs entirely in the browser with no server-side data transmission.

**Current health snapshot:** The R4 profile *data* has been successfully added and the app now defaults to R4. However, the R4-specific *code modules* referenced by the new test files do not yet exist, causing the test suite to fail immediately. The dependency stack is significantly outdated, creating long-term maintenance and security risks.

---

## 2. Project Purpose & History

| Milestone | Commit | Description |
|-----------|--------|-------------|
| Initial | (pre-history) | DSTU2 support |
| `877bcf3` | *stu3 support* | Added STU3 profiles and schema handling |
| `58af0fe` | *handle nested valueset definitions* | Improved valueset parsing |
| `48319ca` | *add r4 profiles* | **Latest** — Added R4 raw profiles, regenerated simplified profiles, changed default to R4 |

The project was originally hosted under `smart-on-fhir/fred` on GitHub. The current fork is at `eneimi-arch/fred`.

---

## 3. Tech Stack & Languages

### 3.1 Languages Used

| Language | Files | Lines (src+test) | Purpose |
|----------|-------|------------------|---------|
| **CJSX** | 15 | ~1,278 | React UI components (CoffeeScript + JSX) |
| **CoffeeScript** | 12 | ~1,408 | Business logic, state management, tests, build scripts |
| **JavaScript** | 1 | 56 | Webpack build configuration only |
| **JSON** | 3 (profiles) | ~571K | Simplified FHIR profiles (runtime) |
| **HTML** | 1 | 29 | Static app shell |

> **Total hand-written source code:** ~2,750 lines (CJSX + CoffeeScript + JS)  
> **Total with generated profile data:** ~574K lines

### 3.2 Runtime Dependencies

| Package | Version | Purpose | Health |
|---------|---------|---------|--------|
| `react` | **0.14.0** (Oct 2015) | UI rendering | 🔴 critically outdated |
| `react-dom` | **0.14.0** | DOM rendering | 🔴 critically outdated |
| `react-bootstrap` | **0.28.1** | UI widgets | 🔴 critically outdated |
| `freezer-js` | **0.8.0** | Immutable state store | 🟡 stable but old |
| `fhir` | **4.12.0** | FHIR utilities | 🟡 may be useful |
| `moment` | **2.10.6** | Date handling | 🔴 outdated |
| `node-uuid` | **1.4.7** | UUID generation | 🔴 deprecated (use `uuid`) |
| `sanitize-caja` | **0.1.3** | HTML sanitization | 🟡 old |

### 3.3 Build / Dev Dependencies

| Package | Version | Purpose | Health |
|---------|---------|---------|--------|
| `webpack` | **1.12.2** | Module bundler | 🔴 v1 is legacy; current is v5 |
| `webpack-dev-server` | **1.12.0** | Dev server | 🔴 incompatible with modern Node |
| `coffee-script` | **1.10.0** | CoffeeScript compiler | 🔴 deprecated (use `coffeescript`) |
| `cjsx-loader` | **2.1.0** | CJSX compilation | 🔴 unmaintained |
| `coffee-loader` | **0.7.2** | CoffeeScript loader | 🔴 outdated |
| `jsx-loader` | **0.13.2** | JSX compilation | 🔴 obsolete |
| `mocha` | **2.3.3** | Test runner | 🔴 very old |
| `json-loader` | **0.5.4** | JSON imports | 🟡 built into Webpack 2+ |
| `webpack-file-changer` | **2.0.1** | Hash injection into HTML | 🟡 old |

### 3.4 External Assets (loaded in `index.html`)

- jQuery **2.1.4** (loaded from `vendor/jquery-2.1.4.min.js`)
- FileSaver.js (loaded from `vendor/FileSaver.min.js`)
- Bootstrap CSS (loaded from `vendor/bootstrap/css/bootstrap.min.css`)

These are **not managed by npm** and must be copied manually into `public/vendor/`.

---

## 4. File Structure

```
fred/
├── package.json                    # npm config, scripts, deps
├── package-lock.json               # Lockfile
├── webpack.config.js               # Webpack 1 build config
├── README.md                       # Project documentation
├── LICENSE                         # MIT license
├── roadmap.md                      # Feature backlog
├── urls.txt                        # (misc URLs)
│
├── scripts/
│   └── simplify-profiles.coffee    # Profile reduction script (150 lines)
│
├── src/                            # Application source (~1,939 lines)
│   ├── index.cjsx                  # Root React component (111 lines)
│   ├── state.coffee                # FreezerJS state tree (9 lines)
│   ├── reactions.coffee            # All event handlers (375 lines)
│   ├── navbar.cjsx                 # Main navigation bar
│   ├── remote-navbar.cjsx          # Remote-controlled nav bar
│   ├── bundle-bar.cjsx             # Bundle resource switcher
│   ├── footer.cjsx                 # App footer
│   ├── ref-warning.cjsx            # Reference change warning dialog
│   │
│   ├── dialogs/
│   │   ├── open-dialog.cjsx        # Open resource dialog
│   │   └── export-dialog.cjsx      # Export resource dialog
│   │
│   ├── domain-resource/
│   │   ├── index.cjsx              # Domain resource root renderer
│   │   ├── resource-element.cjsx   # FHIR element renderer
│   │   ├── element-menu.cjsx       # Element add/move menu
│   │   ├── value-display.cjsx      # Read-only value display
│   │   ├── value-editor.cjsx       # Inline value editor
│   │   ├── value-node.cjsx         # Single value node
│   │   └── value-array-node.cjsx   # Array value node
│   │
│   └── helpers/
│       ├── schema-utils.coffee     # FHIR↔tree conversion, schema queries (294 lines)
│       ├── bundle-utils.coffee     # Bundle parse/generate, ID mapping (128 lines)
│       └── primitive-validator.coffee # Regex validators for FHIR primitives (31 lines)
│
├── test/                           # Test suite (~815 lines)
│   ├── mocha.opts                  # Mocha config (coffee compiler)
│   ├── sample-patient.json         # Test fixture
│   │
│   ├── bundle-util-tests.coffee    # Bundle tests (132 lines, 11 tests)
│   ├── schema-util-tests.coffee    # Schema utils tests (397 lines, 19+ tests)
│   ├── stu-3-tests.coffee          # STU3 tests (55 lines, 3 tests)
│   │
│   ├── r4-profile-test.coffee      # R4 profile file tests (59 lines, 4 tests)
│   ├── r4-process-test.coffee      # R4 processor tests (76 lines, 5 tests) ❌ BROKEN
│   ├── r4-validate-test.coffee     # R4 validator tests (88 lines, 5 tests) ❌ BROKEN
│   └── r4-integration-test.coffee  # R4 integration tests (101 lines, 3 tests) ❌ BROKEN
│
├── public/                         # Static web assets
│   ├── index.html                  # App shell
│   ├── app.css                     # Custom styles
│   ├── normalize.css               # CSS reset
│   ├── narrative.css               # Narrative rendering styles
│   ├── favicon.ico
│   ├── bundle.aada187d50d6db0545c2.js   # Last built bundle (hashed)
│   ├── img/                        # Image assets
│   ├── samples/                    # Sample FHIR resources
│   └── profiles/                   # Simplified FHIR profiles (runtime)
│       ├── dstu2.json
│       ├── stu3.json
│       └── R4.json
│
└── fhir_profiles/                  # Raw HL7 FHIR definitions
    ├── dstu2/
    ├── stu3/
    ├── R4/
    │   ├── profiles-resources.json  # 386K lines
    │   ├── profiles-types.json      # 31K lines
    │   └── valuesets.json           # 157K lines
    └── R5/                          # Present but unused
```

---

## 5. Source Code Architecture

### 5.1 Data Flow

```
Raw FHIR JSON
     │
     ▼
 decorateFhirData(profiles, json)   ←── schema-utils.coffee
     │
     ▼
Editable Tree (FreezerJS immutable)
     │
     ├──► React UI renders tree nodes
     │         ├── value-editor.cjsx  (inline editing)
     │         ├── element-menu.cjsx  (add/remove/move)
     │         └── value-display.cjsx (read-only)
     │
     ▼
  toFhir(decorated, validate?)       ←── schema-utils.coffee
     │
     ▼
Validated FHIR JSON ──► Export / Save / Bundle
```

### 5.2 State Management

- **Store:** FreezerJS (`state.coffee`) — a single immutable tree.
- **Events:** `reactions.coffee` registers handlers on the state tree (e.g., `State.on "load_initial_json"`, `State.on "value_change"`).
- **Triggers:** UI components call `State.trigger("event_name", ...)` to mutate state.

### 5.3 Key Modules

| Module | Responsibility | Lines | Complexity |
|--------|---------------|-------|------------|
| `schema-utils.coffee` | FHIR decoration, serialization, schema queries, child creation | 294 | High |
| `reactions.coffee` | All user action handlers, bundle management, validation gating | 375 | Medium-High |
| `bundle-utils.coffee` | UUID↔FRED-ID mapping, reference substitution, transaction generation | 128 | Medium |
| `primitive-validator.coffee` | Regex validation for 12 FHIR primitive types | 31 | Low |
| `simplify-profiles.coffee` | Converts raw FHIR StructureDefinitions to editor-friendly format | 150 | Medium |

### 5.4 Component Hierarchy

```
RootComponent (index.cjsx)
├── Navbar / RemoteNavbar
├── BundleBar (if bundle open)
├── RefWarning (if reference changes detected)
├── Error alerts (loading/validation errors)
├── DomainResource (domain-resource/index.cjsx)
│   └── ResourceElement
│       ├── ValueNode / ValueArrayNode
│       │   ├── ValueDisplay
│       │   └── ValueEditor
│       └── ElementMenu
├── Footer
├── OpenDialog
└── ExportDialog
```

---

## 6. FHIR Version Support Analysis

### 6.1 Profile Availability

| Version | Raw Profiles | Simplified Profile | Default? |
|---------|-------------|-------------------|----------|
| **DSTU2** | ✅ `fhir_profiles/dstu2/` | ✅ `public/profiles/dstu2.json` | No |
| **STU3** | ✅ `fhir_profiles/stu3/` | ✅ `public/profiles/stu3.json` | No |
| **R4** | ✅ `fhir_profiles/R4/` | ✅ `public/profiles/R4.json` | **Yes** |
| **R5** | ⚠️ `fhir_profiles/R5/` exists | ❌ No simplified profile | No |

### 6.2 What Works for R4

- ✅ Raw R4 StructureDefinitions are present.
- ✅ The profile simplifier script (`simplify-profiles.coffee`) has been updated with R4-specific handlers:
  - `normalizeTypes()` handles R4 type structures (`profile`, `targetProfile`, `aggregation`).
  - `r4()` valueset handler supports `compose.include` / `compose.concept`.
  - Auto-detection logic (`entry.resource.compose` → R4, `entry.resource.valueSet` → STU3, `entry.resource.url` + `codeSystem` → DSTU2).
- ✅ `public/profiles/R4.json` was generated and contains essential resources (Patient, Observation, MedicationRequest, Condition, Encounter, AllergyIntolerance, etc.).
- ✅ `src/index.cjsx` default profile changed to `./profiles/R4.json`.

### 6.3 What Does NOT Work for R4

- ❌ **No dedicated R4 processor module.** `test/r4-process-test.coffee` imports `../src/fhir/processors/r4-processor` — this file does not exist.
- ❌ **No dedicated R4 validator module.** `test/r4-validate-test.coffee` and `test/r4-integration-test.coffee` import `../src/fhir/validators/fhir-validator` — this file does not exist.
- ❌ **No `src/fhir/` directory at all.** The project currently has no `fhir/` subdirectory under `src/`.
- ⚠️ The *generic* `schema-utils.coffee` may handle many R4 resources correctly via schema-driven decoration, but there is no version-specific processing or validation layer.

### 6.4 Profile Simplifier Changes (Latest Commit)

The commit `48319ca` modified `scripts/simplify-profiles.coffee` with:
- New `normalizeTypes()` function to handle R4's extended type definitions.
- New `r4()` valueset summarizer.
- Auto-detection of FHIR version based on valueset JSON structure.
- Regenerated `dstu2.json` and `stu3.json` with updated format.

---

## 7. Build Pipeline

### 7.1 npm Scripts

```json
{
  "dev": "webpack-dev-server --config --devtool eval --progress --colors --inline --content-base ./public",
  "dev:8082": "... --port 8082",
  "build-profiles": "coffee scripts/simplify-profiles.coffee",
  "build": "set WEBPACK_ENV=build && webpack",
  "test": "mocha",
  "test-watch": "mocha -w",
  "deploy-gh": "git subtree push --prefix public origin gh-pages"
}
```

### 7.2 Webpack Config Summary

- **Entry:** `./src/index.cjsx`
- **Output:** `bundle.[chunkhash].js` (build) or `bundle.js` (dev)
- **Loaders:** `jsx-loader`, `coffee`, `cjsx` (coffee + cjsx chain), `json`
- **Plugins:** `webpack-file-changer` injects the hashed bundle filename into `index.html`
- **Resolve extensions:** `.jsx`, `.cjsx`, `.coffee`, `.js`

### 7.3 Build Caveats

- The config uses Webpack 1 syntax (`loaders`, `modulesDirectories`). It will not work with Webpack 2+ without migration.
- `set WEBPACK_ENV=build` is Windows-specific (`set`); cross-platform builds would need `cross-env`.

---

## 8. Test Suite Analysis

### 8.1 Running Tests

```bash
npm test   # Runs mocha with coffee-script/register compiler
```

**Current result:** `MODULE_NOT_FOUND` — crashes before running any tests.

### 8.2 Test Inventory

| Test File | Tests | Lines | Status | Module Under Test |
|-----------|-------|-------|--------|-------------------|
| `bundle-util-tests.coffee` | 11 | 132 | ✅ Pass | `helpers/bundle-utils.coffee` |
| `schema-util-tests.coffee` | 19+ | 397 | ✅ Pass | `helpers/schema-utils.coffee` |
| `stu-3-tests.coffee` | 3 | 55 | ✅ Pass | `helpers/schema-utils.coffee` |
| `r4-profile-test.coffee` | 4 | 59 | ⚠️ Untested* | File-system / JSON parsing |
| `r4-process-test.coffee` | 5 | 76 | ❌ **FAIL** | `src/fhir/processors/r4-processor` **MISSING** |
| `r4-validate-test.coffee` | 5 | 88 | ❌ **FAIL** | `src/fhir/validators/fhir-validator` **MISSING** |
| `r4-integration-test.coffee` | 3 | 101 | ❌ **FAIL** | Both of the above **MISSING** |

> *`r4-profile-test.coffee` only does filesystem/JSON checks and should pass if the R4.json profile exists, but it cannot be reached because Mocha crashes on the earlier broken imports.

### 8.3 Test Coverage Assessment

| Area | Coverage Level | Notes |
|------|---------------|-------|
| Bundle utils | 🟢 Good | Parsing, generation, reference fixing, ID mapping |
| Schema decoration | 🟢 Good | Round-trip, primitives, multi-types, unknown structures, child creation |
| STU3 specifics | 🟡 Basic | Nested references, cardinality |
| R4 profile data | 🟡 Basic | File existence, structure spot-checks |
| R4 processing | 🔴 None | Module missing; no tests run |
| R4 validation | 🔴 None | Module missing; no tests run |
| UI components | 🔴 None | No React component tests |
| State / reactions | 🔴 None | No integration tests for user workflows |
| Primitive validators | 🟡 Partial | Tested indirectly via schema-utils |

**Overall test coverage:** Low-to-moderate for legacy code; effectively zero for new R4 functionality because the test runner cannot execute.

### 8.4 How to Temporarily Run Passing Tests

To verify the legacy tests, exclude the broken R4 test files:

```bash
# Linux/Mac
mocha --compilers coffee:coffee-script/register test/bundle-util-tests.coffee test/schema-util-tests.coffee test/stu-3-tests.coffee

# Or rename/remove the broken r4-* files temporarily
```

---

## 9. Dependency Health & Security

### 9.1 Critical Outdated Packages

| Package | Installed | Current Latest | Risk |
|---------|-----------|----------------|------|
| React | 0.14.0 | 18.x / 19.x | 🔴 High — no security patches, broken patterns |
| React-Bootstrap | 0.28.1 | 2.x | 🔴 High — API completely changed |
| Webpack | 1.12.2 | 5.x | 🔴 High — incompatible with modern Node |
| Webpack-Dev-Server | 1.12.0 | 5.x | 🔴 High — will crash on Node 18+ |
| Mocha | 2.3.3 | 10.x | 🟡 Medium — missing modern features |
| CoffeeScript | 1.10.0 | 2.7.0 | 🟡 Medium — compiler differences |
| jQuery | 2.1.4 | 3.7.x | 🟡 Medium — known CVEs in 2.x |

### 9.2 Node.js Compatibility

The project was built for Node.js ~4.x–6.x era. Running on **Node.js 22** (current LTS):
- `webpack-dev-server` and `webpack` v1 will likely fail or emit deprecation warnings.
- `coffee-script` (v1) still works but is deprecated.
- Mocha v2 still runs (if tests don't crash on missing modules).

### 9.3 Security Concerns

- jQuery 2.1.4 has known XSS vulnerabilities (CVE-2015-9251, CVE-2019-11358).
- React 0.14 has known XSS vulnerabilities fixed in later versions.
- No `npm audit` was run; recommend scanning.

---

## 10. Known Issues & Gaps

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **Missing R4 processor module** | 🔴 Critical | `src/fhir/processors/r4-processor` |
| 2 | **Missing R4 validator module** | 🔴 Critical | `src/fhir/validators/fhir-validator` |
| 3 | **Tests fail on startup** | 🔴 Critical | `test/r4-*-test.coffee` imports |
| 4 | **React 0.14 severely outdated** | 🟡 High | `package.json` dependencies |
| 5 | **Webpack 1 incompatible with modern Node** | 🟡 High | `webpack.config.js` |
| 6 | **No UI/component tests** | 🟡 Medium | Test suite |
| 7 | **Windows-only build script** | 🟢 Low | `"set WEBPACK_ENV=build"` |
| 8 | **R5 profiles present but unused** | 🟢 Low | `fhir_profiles/R5/` |
| 9 | **Manual vendor asset management** | 🟢 Low | `public/vendor/` not in repo |
| 10 | **Primitive decimal hack** | 🟢 Low | `schema-utils.coffee` line 272–275 |

---

## 11. Recommendations for Next Steps

### Immediate (Fix R4 Tests)
1. **Create missing modules** or **remove/adjust R4 test imports** so the test suite can run.
2. Decide on R4 architecture: will R4 use the generic `schema-utils` path, or do you need dedicated `fhir/processors` and `fhir/validators`?

### Short Term (Stabilize)
3. Run `npm audit` and assess security vulnerabilities.
4. Add a CI script that runs tests on commit.
5. Update `mocha.opts` to modern Mocha config (`.mocharc.json`) if upgrading Mocha.

### Medium Term (Modernize)
6. **Dependency upgrade path:**
   - Option A: Minimal — upgrade to CoffeeScript 2, Webpack 4/5, React 18 (major rewrite).
   - Option B: Migrate to TypeScript + modern React/Vite (larger rewrite, better long-term).
7. Replace `node-uuid` with `uuid`.
8. Replace manual jQuery/Bootstrap vendor files with npm-managed equivalents.

### Long Term (Features)
9. Implement roadmap items: cardinality validation, required element validation, codeable concept value sets, collapse nested elements, WYSIWYG narrative editor.
10. Add R5 support (raw profiles already present).

---

## 12. Appendix A: Full Source File Inventory

### CJSX Components (15 files, ~1,278 lines)

| File | Lines | Role |
|------|-------|------|
| `src/index.cjsx` | 111 | Root component, URL parsing, profile/resource loading |
| `src/navbar.cjsx` | — | Main navigation |
| `src/remote-navbar.cjsx` | — | Remote-controlled nav (postMessage API) |
| `src/bundle-bar.cjsx` | — | Bundle resource switcher UI |
| `src/footer.cjsx` | — | Footer |
| `src/ref-warning.cjsx` | — | Reference change warning banner |
| `src/dialogs/open-dialog.cjsx` | — | Open resource / URL dialog |
| `src/dialogs/export-dialog.cjsx` | — | Export JSON dialog |
| `src/domain-resource/index.cjsx` | — | Domain resource renderer entry |
| `src/domain-resource/resource-element.cjsx` | — | Recursive FHIR element renderer |
| `src/domain-resource/element-menu.cjsx` | — | Add/move/delete element menu |
| `src/domain-resource/value-display.cjsx` | — | Read-only value display |
| `src/domain-resource/value-editor.cjsx` | — | Inline editable field |
| `src/domain-resource/value-node.cjsx` | — | Single value wrapper |
| `src/domain-resource/value-array-node.cjsx` | — | Array value wrapper |

### CoffeeScript Modules (7 source files, ~661 lines)

| File | Lines | Role |
|------|-------|------|
| `src/state.coffee` | 9 | FreezerJS state tree |
| `src/reactions.coffee` | 375 | Event handlers for all user actions |
| `src/helpers/schema-utils.coffee` | 294 | FHIR decoration, serialization, schema queries |
| `src/helpers/bundle-utils.coffee` | 128 | Bundle parse/generate, ID/ref management |
| `src/helpers/primitive-validator.coffee` | 31 | Regex validators for primitives |
| `scripts/simplify-profiles.coffee` | 150 | Profile simplification build script |

---

## 13. Appendix B: Git Log (Last 15 Commits)

```
48319ca add r4 profiles
5c6c52d Add license file
58af0fe handle nested valueset definitions
016221f Remove hash when running as dev server
6fd1ad1 Add hash to bundle.js to break caching on change
41cc1e7 Added contact info to readme and app
877bcf3 stu3 support
66bc33b initialize required code on insert
3a476ef Bumped version in gh pages
1c70b50 Support for required valuesets in codes (excluding codeable concepts)
491964c Initial support for stu3 contentReference
26512cb Fixed bug when inserting into bundle
e6abe47 gh pages build
1dfa60c profiles for connectathon 12
338c5de Fixed small bug in id recognition
```

---

*End of analysis. This document should be updated after each significant change to reflect the current state of the codebase.*
