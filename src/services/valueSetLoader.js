/**
 * FHIR ValueSet Loader Service
 * 
 * Features:
 * - Loads from local /valueSets/R4/ folder
 * - Intelligent caching (memory + localStorage)
 * - Lazy loading (only loads when needed)
 * - Pre-fetching for common valuesets
 * - Index file for fast lookups
 */

class ValueSetLoader {
  constructor() {
    this.cache = new Map(); // Memory cache
    this.index = null; // ValueSet index
    this.loadingPromises = new Map(); // Prevent duplicate loads
    this.baseUrl = '/valueSets/R4/';
    
    // Commonly used valuesets to pre-load
    this.priorityValueSets = [
      'administrative-gender',
      'name-use',
      'address-use',
      'address-type',
      'identifier-use',
      'contact-point-system',
      'contact-point-use',
      'mimarcs-language'
    ];
  }

  /**
   * Initialize: Load index and pre-cache priority valuesets
   */
  async initialize() {
    console.log('📦 Initializing ValueSet Loader...');
    
    try {
      // Load or build index
      await this.loadIndex();
      
      // Pre-load common valuesets in background
      setTimeout(() => {
        this.preloadPriorityValueSets();
      }, 1000); // After initial page load
      
      console.log(`✅ ValueSet Loader ready (${this.index ? this.index.count : 0} indexed)`);
      
    } catch (error) {
      console.warn('⚠️ ValueSet initialization warning:', error.message);
      // Continue without index - will use fallback naming convention
    }
  }

  /**
   * Load ValueSet index file (or generate on-the-fly)
   */
  async loadIndex() {
    try {
      const response = await fetch(`${this.baseUrl}index.json`);
      if (response.ok) {
        this.index = await response.json();
        return;
      }
    } catch (error) {
      console.log('Index file not found, will use URL-based lookup');
    }
    
    // Generate minimal index if not exists
    this.index = {
      generated: new Date().toISOString(),
      count: 0,
      urlToName: {},
      nameToUrl: {}
    };
  }

  /**
   * Main method: Get ValueSet options by binding URL
   */
  async getValueSetOptions(bindingUrl, options = {}) {
    if (!bindingUrl) {
      console.warn('No binding URL provided');
      return [];
    }

    const { 
      maxOptions = 100,     // Limit options for UI performance
      includeDesignations = false,
      timeout = 3000        // Max load time
    } = options;

    // Normalize URL to filename
    const valueSetName = this.extractValueSetName(bindingUrl);
    
    // Check memory cache first (FASTEST)
    if (this.cache.has(valueSetName)) {
      console.log(`📋 Cache hit: ${valueSetName}`);
      return this.getCachedOptions(valueSetName, maxOptions);
    }
    
    // Check if already loading (prevent duplicate requests)
    if (this.loadingPromises.has(valueSetName)) {
      console.log(`⏳ Already loading: ${valueSetName}`);
      return this.loadingPromises.get(valueSetName);
    }
    
    // Load with deduplication
    const loadingPromise = this.loadAndCache(valueSetName, bindingUrl, maxOptions)
      .finally(() => {
        this.loadingPromises.delete(valueSetName);
      });
    
    this.loadingPromises.set(valueSetName, loadingPromise);
    
    // Add timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );
    
    return Promise.race([loadingPromise, timeoutPromise])
      .catch(error => {
        console.error(`❌ Failed to load ${valueSetName}:`, error.message);
        return this.getFallbackOptions(bindingUrl);
      });
  }

  /**
   * Extract ValueSet name from URL
   * Examples:
   * http://hl7.org/fhir/ValueSet/administrative-gender -> administrative-gender
   * http://hl7.org/fhir/ValueSet/name-use -> name-use
   */
  extractValueSetName(url) {
    if (!url) return null;
    
    // Remove trailing slash, query params, fragments
    let cleanUrl = url.split('?')[0].split('#')[0].replace(/\/$/, '');
    
    // Get last part of path
    const parts = cleanUrl.split('/');
    let name = parts[parts.length - 1];
    
    // Remove .json extension if present
    name = name.replace(/\.json$/i, '');
    
    return name;
  }

  /**
   * Load ValueSet JSON and cache it
   */
  async loadAndCache(valueSetName, originalUrl, maxOptions) {
    console.log(`💾 Loading: ${valueSetName}`);
    
    try {
      // Try multiple filename variations
      const filenames = [
        `${valueSetName}.json`,
        `${valueSetName.toLowerCase()}.json`,
        `valueset-${valueSetName}.json`,
        `vs-${valueSetName}.json`
      ];
      
      let valueSetData = null;
      
      for (const filename of filenames) {
        try {
          const response = await fetch(`${this.baseUrl}${filename}`, {
            headers: { 'Accept': 'application/json' }
          });
          
          if (response.ok) {
            valueSetData = await response.json();
            console.log(`✅ Loaded: ${filename} (${(response.headers.get('content-length') || 0) / 1024}KB)`);
            break;
          }
        } catch (fileError) {
          continue; // Try next filename
        }
      }
      
      if (!valueSetData) {
        throw new Error(`ValueSet not found: ${valueSetName}`);
      }
      
      // Parse and cache options
      const parsedOptions = this.parseValueSet(valueSetData, maxOptions);
      this.cache.set(valueSetName, {
        data: valueSetData,
        options: parsedOptions,
        loadedAt: Date.now()
      });
      
      // Also cache in localStorage for persistence (optional)
      this.persistToLocalStorage(valueSetName, parsedOptions);
      
      return parsedOptions;
      
    } catch (error) {
      console.error(`Load error for ${valueSetName}:`, error);
      throw error;
    }
  }

  /**
   * Parse ValueSet JSON into flat options array
   */
  parseValueSet(valueSetData, maxOptions = 100) {
    const options = [];
    
    // Method 1: From compose.include[].concept[] (most common in downloaded files)
    if (valueSetData.compose && Array.isArray(valueSetData.compose.include)) {
      valueSetData.compose.include.forEach(include => {
        const system = include.system || '';
        
        if (Array.isArray(include.concept)) {
          include.concept.forEach(concept => {
            if (options.length < maxOptions) {
              options.push({
                code: concept.code,
                display: concept.display || concept.code,
                system: system,
                definition: concept.definition || '',
                // Include designations if requested
                ...(includeDesignations && concept.designation ? {
                  designations: concept.designation
                } : {})
              });
            }
          });
          
          // Handle nested concepts (hierarchy)
          if (Array.isArray(include.concept)) {
            include.concept.forEach(concept => {
              if (concept.concept && options.length < maxOptions) {
                this.flattenConcepts(concept.concept, system, options, maxOptions, 1);
              }
            });
          }
        }
        
        // Handle filter-based includes (would need expansion server)
        if (include.filter && !include.concept) {
          console.warn(`⚠️ ValueSet uses filters, may need expansion: ${system}`);
        }
      });
    }
    
    // Method 2: From expansion.contains[] (pre-expanded)
    if (valueSetData.expansion && Array.isArray(valueSetData.expansion.contains)) {
      valueSetData.expansion.contains.forEach(contain => {
        if (options.length < maxOptions) {
          options.push({
            code: contain.code,
            display: contain.display || contain.code,
            system: contain.system || '',
            abstract: contain.abstract || false,
            version: contain.version || ''
          });
          
          // Nested contains
          if (contain.contains && options.length < maxOptions) {
            this.flattenContains(contain.contains, options, maxOptions);
          }
        }
      });
    }
    
    console.log(`📊 Parsed ${options.length} options`);
    return options;
  }

  /**
   * Flatten hierarchical concepts recursively
   */
  flattenConcepts(concepts, system, options, maxOptions, depth) {
    concepts.forEach(concept => {
      if (options.length < maxOptions) {
        options.push({
          code: concept.code,
          display: '  '.repeat(depth) + (concept.display || concept.code),
          system: system,
          definition: concept.definition || '',
          depth: depth
        });
        
        if (concept.concept) {
          this.flattenConcepts(concept.concept, system, options, maxOptions, depth + 1);
        }
      }
    });
  }

  flattenContains(contains, options, maxOptions) {
    contains.forEach(item => {
      if (options.length < maxOptions) {
        options.push({
          code: item.code,
          display: item.display || item.code,
          system: item.system || ''
        });
        
        if (item.contains) {
          this.flattenContains(item.contains, options, maxOptions);
        }
      }
    });
  }

  /**
   * Get cached options
   */
  getCachedOptions(valueSetName, maxOptions) {
    const cached = this.cache.get(valueSetName);
    if (!cached) return [];
    
    return cached.options.slice(0, maxOptions);
  }

  /**
   * Persist to localStorage (optional - for offline support)
   */
  persistToLocalStorage(valueSetName, options) {
    try {
      const key = `fred_vs_${valueSetName}`;
      const data = {
        options: options,
        cachedAt: Date.now()
      };
      
      // Only store if localStorage available and not full
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(data);
        if (serialized.length < 50000) { // < 50KB per valueset
          localStorage.setItem(key, serialized);
        }
      }
    } catch (error) {
      // localStorage might be full or disabled
      console.debug('localStorage persist failed:', error.message);
    }
  }

  /**
   * Load from localStorage cache
   */
  loadFromLocalStorage(valueSetName) {
    try {
      const key = `fred_vs_${valueSetName}`;
      const cached = localStorage.getItem(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        // Cache is valid for 7 days
        const age = Date.now() - data.cachedAt;
        if (age < 7 * 24 * 60 * 60 * 1000) {
          return data.options;
        }
        // Expired - remove
        localStorage.removeItem(key);
      }
    } catch (error) {
      // Ignore localStorage errors
    }
    
    return null;
  }

  /**
   * Pre-load commonly used valueSets
   */
  async preloadPriorityValueSets() {
    console.log(`⚡ Pre-loading ${this.priorityValueSets.length} priority ValueSets...`);
    
    const startTime = Date.now();
    
    // Load in parallel batches
    const BATCH_SIZE = 3;
    
    for (let i = 0; i < this.priorityValueSets.length; i += BATCH_SIZE) {
      const batch = this.priorityValueSets.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (vsName) => {
        try {
          await this.getValueSetOptions(
            `http://hl7.org/fhir/ValueSet/${vsName}`,
            { maxOptions: 50 }
          );
        } catch (error) {
          console.log(`Pre-load failed for ${vsName}:`, error.message);
        }
      }));
      
      // Small delay between batches to not block UI
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Pre-loading complete (${elapsed}s), cache size: ${this.cache.size}`);
  }

  /**
   * Fallback options when ValueSet cannot be loaded
   */
  getFallbackOptions(bindingUrl) {
    const name = this.extractValueSetName(bindingUrl);
    
    // Common hardcoded fallbacks
    const fallbacks = {
      'administrative-gender': [
        { code: 'male', display: 'Male', system: 'http://hl7.org/fhir/administrative-gender' },
        { code: 'female', display: 'Female', system: 'http://hl7.org/fhir/administrative-gender' },
        { code: 'other', display: 'Other', system: 'http://hl7.org/fhir/administrative-gender' },
        { code: 'unknown', display: 'Unknown', system: 'http://hl7.org/fhir/administrative-gender' }
      ],
      'name-use': [
        { code: 'usual', display: 'Usual' },
        { code: 'official', display: 'Official' },
        { code: 'temp', display: 'Temp' },
        { code: 'nickname', display: 'Nickname' },
        { code: 'anonymous', display: 'Anonymous' },
        { code: 'old', display: 'Old' },
        { code: 'maiden', display: 'Maiden Name' }
      ]
    };
    
    if (fallbacks[name]) {
      console.log(`Using fallback for: ${name}`);
      return fallbacks[name];
    }
    
    // Return empty array - component should allow free text input
    console.warn(`No fallback for: ${name}, allowing free text`);
    return [];
  }

  /**
   * Clear all caches (useful for testing)
   */
  clearCache() {
    this.cache.clear();
    this.loadingPromises.clear();
    
    // Clear localStorage caches
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('fred_vs_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    console.log('🗑️ All caches cleared');
  }

  /**
   * Get statistics (for debugging)
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingLoads: this.loadingPromises.size,
      cachedValueSets: Array.from(this.cache.keys()),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  estimateMemoryUsage() {
    let totalSize = 0;
    this.cache.forEach((value, key) => {
      totalSize += JSON.stringify(value).length;
    });
    return `${(totalSize / 1024).toFixed(1)} KB`;
  }
}

// Export singleton instance
export default new ValueSetLoader();