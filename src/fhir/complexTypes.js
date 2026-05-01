/**
 * FHIR R4 Complex Type Definitions
 * 
 * Provides field definitions for complex FHIR data types
 */

export function getComplexTypeDefinition(typeName, parentPath = '') {
  const definitions = {
    
    HumanName: [
      { 
        id: `${parentPath}.use`, 
        path: `${parentPath}.use`, 
        name: 'use', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1',
        binding: {
          strength: 'required',
          valueSet: 'http://hl7.org/fhir/ValueSet/name-use',
          description: 'Use of this name'
        },
        shortDescription: 'usual | official | temp | nickname | anonymous | old | maiden'
      },
      { 
        id: `${parentPath}.text`, 
        path: `${parentPath}.text`, 
        name: 'text', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1',
        shortDescription: 'Full text representation of the name'
      },
      { 
        id: `${parentPath}.family`, 
        path: `${parentPath}.family`, 
        name: 'family', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1',
        shortDescription: 'Family name (surname)'
      },
      { 
        id: `${parentPath}.given`, 
        path: `${parentPath}.given`, 
        name: 'given', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '*',
        shortDescription: 'Given names (first/middle)'
      },
      { 
        id: `${parentPath}.prefix`, 
        path: `${parentPath}.prefix`, 
        name: 'prefix', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '*',
        shortDescription: 'Parts that come before the name (Dr, Mr, etc.)'
      },
      { 
        id: `${parentPath}.suffix`, 
        path: `${parentPath}.suffix`, 
        name: 'suffix', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '*',
        shortDescription: 'Parts that come after the name (Jr, III, etc.)'
      },
      { 
        id: `${parentPath}.period`, 
        path: `${parentPath}.period`, 
        name: 'period', 
        type: [{ code: 'Period' }],
        min: 0, 
        max: '1',
        shortDescription: 'Time period when name was/is in use'
      }
    ],

    Address: [
      { 
        id: `${parentPath}.use`, 
        path: `${parentPath}.use`, 
        name: 'use', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1',
        binding: {
          strength: 'required',
          valueSet: 'http://hl7.org/fhir/ValueSet/address-use'
        }
      },
      { 
        id: `${parentPath}.type`, 
        path: `${parentPath}.type`, 
        name: 'type', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1',
        binding: {
          strength: 'required',
          valueSet: 'http://hl7.org/fhir/ValueSet/address-type'
        }
      },
      { 
        id: `${parentPath}.text`, 
        path: `${parentPath}.text`, 
        name: 'text', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.line`, 
        path: `${parentPath}.line`, 
        name: 'line', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '*'
      },
      { 
        id: `${parentPath}.city`, 
        path: `${parentPath}.city`, 
        name: 'city', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.district`, 
        path: `${parentPath}.district`, 
        name: 'district', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.state`, 
        path: `${parentPath}.state`, 
        name: 'state', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.postalCode`, 
        path: `${parentPath}.postalCode`, 
        name: 'postalCode', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.country`, 
        path: `${parentPath}.country`, 
        name: 'country', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.period`, 
        path: `${parentPath}.period`, 
        name: 'period', 
        type: [{ code: 'Period' }],
        min: 0, 
        max: '1'
      }
    ],

    Identifier: [
      { 
        id: `${parentPath}.use`, 
        path: `${parentPath}.use`, 
        name: 'use', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1',
        binding: {
          strength: 'required',
          valueSet: 'http://hl7.org/fhir/ValueSet/identifier-use'
        }
      },
      { 
        id: `${parentPath}.type`, 
        path: `${parentPath}.type`, 
        name: 'type', 
        type: [{ code: 'CodeableConcept' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.system`, 
        path: `${parentPath}.system`, 
        name: 'system', 
        type: [{ code: 'uri' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.value`, 
        path: `${parentPath}.value`, 
        name: 'value', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.period`, 
        path: `${parentPath}.period`, 
        name: 'period', 
        type: [{ code: 'Period' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.assigner`, 
        path: `${parentPath}.assigner`, 
        name: 'assigner', 
        type: [{ code: 'Reference' }],
        min: 0, 
        max: '1'
      }
    ],

    CodeableConcept: [
      { 
        id: `${parentPath}.coding`, 
        path: `${parentPath}.coding`, 
        name: 'coding', 
        type: [{ code: 'Coding' }],
        min: 0, 
        max: '*'
      },
      { 
        id: `${parentPath}.text`, 
        path: `${parentPath}.text`, 
        name: 'text', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1',
        shortDescription: 'Plain text representation'
      }
    ],

    Coding: [
      { 
        id: `${parentPath}.system`, 
        path: `${parentPath}.system`, 
        name: 'system', 
        type: [{ code: 'uri' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.version`, 
        path: `${parentPath}.version`, 
        name: 'version', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.code`, 
        path: `${parentPath}.code`, 
        name: 'code', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.display`, 
        path: `${parentPath}.display`, 
        name: 'display', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.userSelected`, 
        path: `${parentPath}.userSelected`, 
        name: 'userSelected', 
        type: [{ code: 'boolean' }],
        min: 0, 
        max: '1'
      }
    ],

    ContactPoint: [
      { 
        id: `${parentPath}.system`, 
        path: `${parentPath}.system`, 
        name: 'system', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1',
        binding: {
          strength: 'required',
          valueSet: 'http://hl7.org/fhir/ValueSet/contact-point-system'
        }
      },
      { 
        id: `${parentPath}.value`, 
        path: `${parentPath}.value`, 
        name: 'value', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.use`, 
        path: `${parentPath}.use`, 
        name: 'use', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1',
        binding: {
          strength: 'required',
          valueSet: 'http://hl7.org/fhir/ValueSet/contact-point-use'
        }
      },
      { 
        id: `${parentPath}.rank`, 
        path: `${parentPath}.rank`, 
        name: 'rank', 
        type: [{ code: 'positiveInt' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.period`, 
        path: `${parentPath}.period`, 
        name: 'period', 
        type: [{ code: 'Period' }],
        min: 0, 
        max: '1'
      }
    ],

    Period: [
      { 
        id: `${parentPath}.start`, 
        path: `${parentPath}.start`, 
        name: 'start', 
        type: [{ code: 'dateTime' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.end`, 
        path: `${parentPath}.end`, 
        name: 'end', 
        type: [{ code: 'dateTime' }],
        min: 0, 
        max: '1'
      }
    ],

    Quantity: [
      { 
        id: `${parentPath}.value`, 
        path: `${parentPath}.value`, 
        name: 'value', 
        type: [{ code: 'decimal' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.comparator`, 
        path: `${parentPath}.comparator`, 
        name: 'comparator', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.unit`, 
        path: `${parentPath}.unit`, 
        name: 'unit', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.system`, 
        path: `${parentPath}.system`, 
        name: 'system', 
        type: [{ code: 'uri' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.code`, 
        path: `${parentPath}.code`, 
        name: 'code', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1'
      }
    ],

    Reference: [
      { 
        id: `${parentPath}.reference`, 
        path: `${parentPath}.reference`, 
        name: 'reference', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.type`, 
        path: `${parentPath}.type`, 
        name: 'type', 
        type: [{ code: 'uri' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.identifier`, 
        path: `${parentPath}.identifier`, 
        name: 'identifier', 
        type: [{ code: 'Identifier' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.display`, 
        path: `${parentPath}.display`, 
        name: 'display', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      }
    ],

    Attachment: [
      { 
        id: `${parentPath}.contentType`, 
        path: `${parentPath}.contentType`, 
        name: 'contentType', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.language`, 
        path: `${parentPath}.language`, 
        name: 'language', 
        type: [{ code: 'code' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.data`, 
        path: `${parentPath}.data`, 
        name: 'data', 
        type: [{ code: 'base64Binary' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.url`, 
        path: `${parentPath}.url`, 
        name: 'url', 
        type: [{ code: 'url' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.size`, 
        path: `${parentPath}.size`, 
        name: 'size', 
        type: [{ code: 'unsignedInt' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.hash`, 
        path: `${parentPath}.hash`, 
        name: 'hash', 
        type: [{ code: 'base64Binary' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.title`, 
        path: `${parentPath}.title`, 
        name: 'title', 
        type: [{ code: 'string' }],
        min: 0, 
        max: '1'
      },
      { 
        id: `${parentPath}.creation`, 
        path: `${parentPath}.creation`, 
        name: 'creation', 
        type: [{ code: 'dateTime' }],
        min: 0, 
        max: '1'
      }
    ]
  };

  return definitions[typeName] || [];
}

/**
 * Check if a type is a complex FHIR type
 */
export function isComplexType(typeName) {
  const complexTypes = [
    'HumanName', 'Address', 'Identifier', 'CodeableConcept', 'Coding',
    'ContactPoint', 'Attachment', 'Reference', 'Quantity', 'Range',
    'Ratio', 'Period', 'Timing', 'Annotation', 'Signature', 'Narrative',
    'BackboneElement', 'DomainResource', 'Resource'
  ];
  
  return complexTypes.includes(typeName);
}

/**
 * Check if a type is primitive
 */
export function isPrimitiveType(typeName) {
  const primitiveTypes = [
    'string', 'boolean', 'integer', 'decimal', 'uri', 'url',
    'base64Binary', 'instant', 'date', 'dateTime', 'time',
    'code', 'oid', 'id', 'markdown', 'unsignedInt', 'positiveInt'
  ];
  
  return primitiveTypes.includes(typeName);
}