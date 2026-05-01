import { SimplifiedProfiles, ProfileEntry, DecoratedNode } from '../types/fhir.d';

// Simple validator for FHIR primitives (mirrors primitive-validator.coffee)
const validators: Record<string, [RegExp, string]> = {
  integer: [/^-?\d+$/, 'Please enter an integer'],
  unsignedInt: [/^[0-9]+$/, 'Please enter a non-negative integer'],
  positiveInt: [/^[1-9][0-9]*$/, 'Please enter a positive integer'],
  id: [/^[A-Za-z0-9\-\.]{1,64}$/, 'Please enter a valid ID'],
  oid: [/^urn:oid:[0-2](\.[1-9]\d*)+$/, 'Please enter a valid OID'],
  decimal: [/^-?\d+\.?\d*/, 'Please enter a decimal'],
  instant: [/^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/, 'Please enter a valid instant'],
  date: [/^-?[0-9]{4}(-(0[1-9]|1[0-2])(-(0[0-9]|[1-2][0-9]|3[0-1]))?)?$/, 'Please enter a valid date'],
  dateTime: [/^-?[0-9]{4}(-(0[1-9]|1[0-2])(-(0[0-9]|[1-2][0-9]|3[0-1])(T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?)?)?)?$/, 'Please enter a valid dateTime'],
  time: [/^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?/, 'Please enter a valid time'],
  string: [/[^\s]/, 'Please enter at least one character'],
  boolean: [/true|false/, 'Please enter true or false'],
};

function validateFormat(fhirType: string, value: any): string | undefined {
  const validator = validators[fhirType] || validators.string;
  if (!validator[0].test(String(value))) {
    return validator[1];
  }
  return undefined;
}

function validatePopulated(value: any): string | undefined {
  if (value == null || value === '') {
    return 'Please enter a value';
  }
  if (/^\s+|\s+$/.test(String(value))) {
    return 'Value can\'t begin or end with spaces';
  }
  return undefined;
}

export function isValid(fhirType: string, value: any, failBlank = false): string | undefined {
  const badFormat = validateFormat(fhirType, value);
  if (badFormat) return badFormat;
  if (failBlank) {
    return validatePopulated(value);
  }
  return undefined;
}

function isComplexType(fhirType: string): boolean {
  return fhirType && fhirType[0] === fhirType[0].toUpperCase();
}

function isInfrastructureType(fhirType: string): boolean {
  return ['DomainResource', 'Element', 'BackboneElement'].includes(fhirType);
}

const unsupportedElements: string[] = [];

let nextId = 0;

export function resetNextId(): void {
  nextId = 0;
}

export function getElementChildren(
  profiles: SimplifiedProfiles['profiles'],
  schemaPath: string,
  excludePaths: string[] = []
): ProfileEntry[] {
  const _buildChild = (name: string, schema: ProfileEntry, typeCode: string): ProfileEntry & { displayName: string } => {
    const displayName = buildDisplayName(schema.path.split('.'), typeCode);
    return {
      ...schema,
      name,
      displayName,
    };
  };

  const _buildMultiTypePermutations = (schema: ProfileEntry) => {
    const permutations: ProfileEntry[] = [];
    for (const type of schema.type || []) {
      if (!type || !type.code) continue;
      const capType = type.code[0].toUpperCase() + type.code.slice(1);
      const name = schema.path.split('.').pop()!.replace('[x]', capType);
      permutations.push(_buildChild(name, schema, type.code));
    }
    return permutations;
  };

  const _isMultiType = (path: string) => path.indexOf('[x]') > -1;

  const children: ProfileEntry[] = [];
  const schemaRoot = schemaPath.split('.').shift()!;
  const level = schemaPath.split('.').length;

  const schemaMap = profiles[schemaRoot];
  if (!schemaMap) return children;

  for (const [path, schema] of Object.entries(schemaMap)) {
    if (excludePaths.includes(path)) continue;
    if (path.indexOf(schemaPath) === -1) continue;
    if (path.split('.').length !== level + 1) continue;

    let s: ProfileEntry = schema;
    if (s.nameReference) {
      const base = schemaPath.split('.').shift()!;
      const ref = schemaMap[base + '.' + s.nameReference];
      if (ref) s = ref;
    }

    if (_isMultiType(path)) {
      children.push(..._buildMultiTypePermutations(s));
    } else {
      const name = s.path.split('.').pop()!;
      if (!unsupportedElements.includes(name)) {
        const type = s.type?.[0]?.code || 'BackboneElement';
        children.push(_buildChild(name, s, type));
      }
    }
  }

  return children.sort((a, b) => a.index - b.index);
}

export function buildDisplayName(schemaPath: string[], fhirType: string): string {
  const _fixCamelCase = (text: string, lowerCase: boolean): string => {
    if (!lowerCase) {
      text = text[0].toUpperCase() + text.slice(1);
    }
    return text;
  };

  const name = schemaPath[schemaPath.length - 1];
  if (name.indexOf('[x]') > -1) {
    return _fixCamelCase(name.replace(/\[x\]/, ''), false) + ' (' + _fixCamelCase(fhirType, true) + ')';
  } else {
    return _fixCamelCase(name, false);
  }
}

export function buildChildNode(
  profiles: SimplifiedProfiles['profiles'],
  parentNodeType: string,
  schemaPath: string,
  fhirType: string
): DecoratedNode {
  const _addRequiredChildren = (parentNodeType: string, schemaPath: string, fhirType: string): DecoratedNode[] => {
    let sp = schemaPath;
    if (isComplexType(fhirType) && !isInfrastructureType(fhirType)) {
      sp = fhirType;
    }
    const children = getElementChildren(profiles, sp);
    const reqChildren: DecoratedNode[] = [];
    for (const child of children) {
      if (child.isRequired) {
        reqChildren.push(buildChildNode(profiles, parentNodeType, child.schemaPath, child.fhirType!));
      }
    }
    return reqChildren;
  };

  const parts = schemaPath.split('.');
  const name = parts[parts.length - 1];
  const schemaMap = profiles[parts[0]];
  if (!schemaMap) throw new Error(`Schema root not found for ${schemaPath}`);
  const schema = schemaMap[parts.join('.')];

  if (!schema) {
    throw new Error(`Schema not found for ${schemaPath}`);
  }

  let parts2 = [...parts];
  if (schema.nameReference) {
    parts2 = [parts[0], schema.nameReference];
  }

  let adjustedName = name;
  if (name.indexOf('[x]') > -1) {
    const capType = fhirType[0].toUpperCase() + fhirType.slice(1);
    adjustedName = schema.path.split('.').pop()!.replace('[x]', capType);
  }

  if (schema.max !== '1' && parentNodeType !== 'valueArray' && parentNodeType !== 'objectArray') {
    const node: DecoratedNode = {
      id: nextId++,
      name: adjustedName,
      index: schema.index,
      schemaPath: parts2.join('.'),
      fhirType,
      displayName: buildDisplayName(parts2, fhirType),
      nodeType: isComplexType(fhirType) ? 'objectArray' : 'valueArray',
      short: schema.short,
      range: [schema.min, schema.max],
      isRequired: schema.min >= 1,
      level: 0,
      children: isComplexType(fhirType)
        ? [buildChildNode(profiles, 'objectArray', parts2.join('.'), fhirType)]
        : [buildChildNode(profiles, 'valueArray', parts2.join('.'), fhirType)],
    };
    return node;
  } else {
    const result: DecoratedNode = {
      id: nextId++,
      name: adjustedName,
      index: schema.index,
      schemaPath: parts2.join('.'),
      fhirType,
      displayName: buildDisplayName(parts2, fhirType),
      isRequired: schema.min >= 1,
      short: schema.short,
      value: fhirType === 'boolean' ? true : null,
      range: [schema.min, schema.max],
      binding: schema.binding,
      nodeType: (isComplexType(fhirType) && parentNodeType === 'objectArray') ? 'arrayObject' :
                (isComplexType(fhirType) ? 'object' : 'value'),
      level: 0,
    };
    if (isComplexType(fhirType)) {
      result.children = _addRequiredChildren(result.nodeType, result.schemaPath, result.fhirType!);
    }
    return result;
  }
}

export function decorateFhirData(profiles: SimplifiedProfiles['profiles'], data: any): DecoratedNode {
  resetNextId();

  const _walkNode = (dataNode: any, schemaPath: string[], level = 0, inArray = false): DecoratedNode => {
    let name: string;
    let displayName: string;
    let schema: ProfileEntry | undefined;
    let fhirType: string | undefined;

    if (dataNode.resourceType) {
      schemaPath = [dataNode.resourceType];
    }

    name = schemaPath[schemaPath.length - 1];
    displayName = buildDisplayName(schemaPath, '');
    const schemaMap = profiles[schemaPath[0]];
    schema = schemaMap?.[schemaPath.join('.')];
    fhirType = schema?.type?.[0]?.code;

    if (isInfrastructureType(fhirType!) && schemaPath.length === 1) {
      fhirType = schemaPath[0];
    }

    if (schema?.refSchema) {
      schemaPath = schema.refSchema.split('.');
      const refSchemaMap = profiles[schemaPath[0]];
      const refSchema = refSchemaMap?.[schemaPath.join('.')];
      fhirType = refSchema?.type?.[0]?.code;
    }

    if (!fhirType) {
      const nameParts = schemaPath[schemaPath.length - 1].split(/(?=[A-Z])/);
      let testSchemaPath = schemaPath.slice(0, schemaPath.length - 1).join('.') + '.';
      for (let i = 0; i < nameParts.length; i++) {
        testSchemaPath += nameParts[i];
        const testSchema = schemaMap?.[`${testSchemaPath}[x]`];
        if (testSchema) {
          schema = testSchema;
          schemaPath = testSchema.path.split('.');
          fhirType = nameParts.slice(i + 1).join('');
          if (!profiles[fhirType]) {
            fhirType = fhirType[0].toLowerCase() + fhirType.slice(1);
          }
          displayName = buildDisplayName(schemaPath, fhirType);
          break;
        }
      }
    }

    const decorated: DecoratedNode = {
      id: nextId++,
      index: schema?.index || 0,
      name,
      nodeType: 'value',
      displayName,
      schemaPath: schemaPath.join('.'),
      fhirType,
      level,
      short: schema?.short,
      isRequired: schema?.min !== undefined && schema.min >= 1,
      binding: schema?.binding,
    };

    if (schema?.min != undefined) {
      decorated.range = [schema.min, schema.max];
    }

    if (name === 'resourceType') {
      decorated.hidden = true;
    }

    if (isComplexType(fhirType!) && !isInfrastructureType(fhirType!)) {
      schemaPath = [fhirType!];
    }

    if (fhirType === 'Attachment' && dataNode.contentType && dataNode.data) {
      decorated.contentType = dataNode.contentType;
    }

    if (Array.isArray(dataNode) && decorated.range && decorated.range[1] !== '1') {
      decorated.children = dataNode.map((v: any) => _walkNode(v, schemaPath, level + 1, true));
      decorated.nodeType = fhirType && isComplexType(fhirType) ? 'objectArray' :
        (!fhirType && typeof dataNode[0] === 'object' ? 'objectArray' : 'valueArray');
    } else if (typeof dataNode === 'object' && !Array.isArray(dataNode) &&
               !(dataNode instanceof Date)) {
      decorated.nodeType = schema && schema.max !== '1' ? 'arrayObject' : 'object';
      decorated.children = Object.entries(dataNode)
        .map(([k, v]) => _walkNode(v, [...schemaPath, k], level + 1))
        .sort((a, b) => a.index - b.index);
    } else {
      if (fhirType === 'decimal' && dataNode !== '') {
        dataNode = parseFloat(dataNode).toString();
        if (dataNode.indexOf('.') === -1) dataNode += '.0';
      }
      decorated.value = dataNode;

      if (decorated.range?.[1] && decorated.range[1] !== '1' && !inArray) {
        decorated.fhirType = undefined;
      }
      if (Array.isArray(dataNode) && decorated.range?.[1] === '1') {
        decorated.fhirType = undefined;
      }

      if (fhirType) {
        const err = isValid(fhirType, dataNode, true);
        if (err) {
          decorated.ui = { validationErr: err, status: 'editing' };
        }
      }
    }

    return decorated;
  };

  return _walkNode(data, []);
}

export function toFhir(decorated: DecoratedNode, validate = false): any | [any, number] {
  let errCount = 0;

  const _walkNode = (node: DecoratedNode, parent: any): any => {
    for (const child of node.children || []) {
      const value = child.nodeType === 'object' || child.nodeType === 'arrayObject'
        ? _walkNode(child, {})
        : child.nodeType === 'valueArray' || child.nodeType === 'objectArray'
          ? _walkNode(child, [])
          : (() => {
              let err: string | undefined;
              if (validate && child.ui?.validationErr) {
                err = child.ui.validationErr;
              } else if (validate && child.fhirType) {
                err = isValid(child.fhirType, child.value, true);
              }
              if (err) errCount++;
              return child.value;
            })();

      if (Array.isArray(parent)) {
        parent.push(value);
      } else {
        parent[child.name] = value;
      }
    }
    return parent;
  };

  const fhir = _walkNode(decorated, {});
  return validate ? [fhir, errCount] : fhir;
}