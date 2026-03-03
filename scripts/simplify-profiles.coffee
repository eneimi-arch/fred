# Reads profile files from ../fhir_profiles/{title} and strips out basic type definitions 
# and items not currently used by the editor to reduce file size.

fs = require "fs"
path = require "path"

inputPath = "../fhir_profiles"
outputPath = "../public/profiles"

# Define helper function at module level
normalizeTypes = (types) ->
    return types unless types
    return types unless Array.isArray(types)
    
    # Normalize R4 type structures
    normalizedTypes = []
    for type in types
        normalizedType = {code: type.code}
        
        # Copy important properties but exclude complex extensions for simplicity
        if type.profile
            normalizedType.profile = type.profile
        if type.targetProfile
            normalizedType.targetProfile = type.targetProfile
        if type.aggregation
            normalizedType.aggregation = type.aggregation
            
        normalizedTypes.push normalizedType
    
    return normalizedTypes

summarizeDirectory = (inputDirName, inputDirPath, outputDirPath) ->
	console.log "Processing #{inputDirName}"
	profiles = {}
	valuesets = {}
	
	for bundleFileName in fs.readdirSync(inputDirPath).sort()
		continue unless bundleFileName.indexOf("json") > -1
		bundleFilePath = path.join(inputDirPath, bundleFileName)
		bundle = JSON.parse fs.readFileSync(bundleFilePath)

		if bundleFileName.indexOf("valuesets") > -1 
			summarizeValuesets(bundle, valuesets)
		else if bundleFileName.indexOf("profiles") > -1
			summarizeProfiles(bundle, profiles)

	fs.writeFileSync path.join(outputDirPath, "#{inputDirName}.json"),
		JSON.stringify {profiles: profiles, valuesets: valuesets}, null, "  "

summarizeValuesets = (fhirBundle, valuesets) ->
	dstu2 = (entry) ->
		url = entry?.resource?.url
		#are they all complete?
		valuesets[url] = {type: "complete", items: []}
		for c, i in entry?.resource?.codeSystem?.concept || []
			valuesets[url].items.push [c.display, c.code]


	stu3 = (entry) -> 
		url = entry?.resource?.valueSet		
		valuesets[url] = {type: entry.resource.content, items: []}

		_addValue = (concept) ->
			for c in concept || []
				if c.concept
					_addValue(c.concept)
				else
					valuesets[url].items.push [c.display, c.code]
				
		_addValue(entry?.resource?.concept)
		
	# Add R4 support for valuesets
	r4 = (entry) ->
		url = entry?.resource?.url || entry?.resource?.valueSet
		content = entry?.resource?.compose?.include?[0]?.system
		typeValue = if content then "complete" else "fragment"
		valuesets[url] = {type: typeValue, items: []}
		
		_addValue = (concept) ->
			for c in concept || []
				if c.concept
					_addValue(c.concept)
				else if c.code
					valuesets[url].items.push [c.display || c.code, c.code]
				
		_addValue(entry?.resource?.compose?.concept)
	
	for entry in fhirBundle?.entry || []
		# Try to detect version and use appropriate handler
		if entry?.resource?.compose # R4 style
			r4(entry)
		else if entry?.resource?.valueSet and entry?.resource?.concept?.length > 0 # STU3 style
			stu3(entry)
		else if entry?.resource?.url and entry?.resource?.codeSystem?.concept?.length > 0 # DSTU2 style
			dstu2(entry)

	return valuesets

summarizeProfiles = (fhirBundle, profiles) ->
	for entry in fhirBundle?.entry || []
		root = entry?.resource?.snapshot?.element?[0]?.path
		continue unless root and 
			root[0] is root[0].toUpperCase()

		ids = {}
		names = {}

		profiles[root] = {}
		for e, i in entry?.resource?.snapshot?.element || []
			profileEntry = 
				index: i
				path: e.path
				min: e.min
				max: e.max
				# Use the module-level helper function
				type: normalizeTypes(e.type) || [{"code": "DomainResource"}]
				isSummary: e.isSummary
				isModifier: e.isModifier
				short: e.short
				name: e.name

			# Handle bindings
			url = e?.binding?.valueSetReference?.reference || e?.binding?.valueSetUri || e?.binding?.valueSet
			if url
				profileEntry.binding =
					strength: e.binding.strength
					reference: url

			profiles[root][e.path] = profileEntry

			# Handle references
			if e.id then ids[e.id] = e.path
			if e.name then names[e.name] = e.path

			# Handle content references
			if e.contentReference
				id = e.contentReference.split("#")[1]
				profiles[root][e.path].refSchema = ids[id]
			else if e.nameReference
				profiles[root][e.path].refSchema = names[e.nameReference]

	return profiles

# Remove debugging before the loop (keep the original structure)
for inputDirName in fs.readdirSync path.join(__dirname, inputPath)
	inputDirPath = path.join(__dirname, inputPath, inputDirName)
	outputDirPath = path.join(__dirname, outputPath)
	if fs.lstatSync(inputDirPath).isDirectory()
		summarizeDirectory(inputDirName, inputDirPath, outputDirPath)

