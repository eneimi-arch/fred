  import { describe, it, expect, beforeEach } from 'vitest';
  import {
    resetNextId,
    getElementChildren,
    buildDisplayName,
    buildChildNode,
    decorateFhirData,
    toFhir,
    isValid
  } from './schema-utils';
  import type { SimplifiedProfiles, ProfileEntry, DecoratedNode } from '../types/fhir.d.ts';

// Minimal test profiles
const testProfiles: SimplifiedProfiles['profiles'] = {
  Patient: {
    'Patient': {
      index: 0,
      path: 'Patient',
      min: 0,
      max: '*',
      type: [{ code: 'DomainResource' }],
      isRequired: false
    },
    'Patient.id': {
      index: 1,
      path: 'Patient.id',
      min: 0,
      max: '1',
      type: [{ code: 'id' }],
      isRequired: false
    },
    'Patient.name': {
      index: 2,
      path: 'Patient.name',
      min: 0,
      max: '*',
      type: [{ code: 'HumanName' }],
      isRequired: false
    },
    'Patient.name.id': {
      index: 3,
      path: 'Patient.name.id',
      min: 0,
      max: '1',
      type: [{ code: 'string' }],
      isRequired: false
    },
    'Patient.name.family': {
      index: 4,
      path: 'Patient.name.family',
      min: 0,
      max: '1',
      type: [{ code: 'string' }],
      isRequired: false
    },
    'Patient.gender': {
      index: 5,
      path: 'Patient.gender',
      min: 0,
      max: '1',
      type: [{ code: 'code' }],
      isRequired: false
    },
    'Patient.active': {
      index: 6,
      path: 'Patient.active',
      min: 0,
      max: '1',
      type: [{ code: 'boolean' }],
      isRequired: false
    }
  },
  HumanName: {
    'HumanName': {
      index: 0,
      path: 'HumanName',
      min: 0,
      max: '*',
      type: [{ code: 'Element' }],
      isRequired: false
    },
    'HumanName.use': {
      index: 1,
      path: 'HumanName.use',
      min: 0,
      max: '1',
      type: [{ code: 'code' }],
      isRequired: false
    },
    'HumanName.given': {
      index: 2,
      path: 'HumanName.given',
      min: 0,
      max: '*',
      type: [{ code: 'string' }],
      isRequired: false
    }
  }
};

describe('isValid', () => {
  it('should validate integer', () => {
    expect(isValid('integer', '123')).toBeNull();
    expect(isValid('integer', '-456')).toBeNull();
    expect(isValid('integer', 'abc')).not.toBeNull();
  });

  it('should validate boolean', () => {
    expect(isValid('boolean', 'true')).toBeNull();
    expect(isValid('boolean', 'false')).toBeNull();
    expect(isValid('boolean', 'yes')).not.toBeNull();
  });

  it('should validate string', () => {
    expect(isValid('string', 'hello')).toBeNull();
    expect(isValid('string', '   ')).not.toBeNull();
  });

  it('should validate date', () => {
    expect(isValid('date', '2023-01-01')).toBeNull();
    expect(isValid('date', 'invalid')).not.toBeNull();
  });

  it('should validate with failBlank', () => {
    expect(isValid('string', '', true)).not.toBeNull();
    expect(isValid('string', 'x', true)).toBeNull();
  });
});

describe('buildDisplayName', () => {
  it('should build display name for simple element', () => {
    expect(buildDisplayName(['Patient', 'name'], 'HumanName')).toBe('Name');
  });

  it('should build display name for multi-type', () => {
    expect(buildDisplayName(['Patient', 'deceased[x]'], 'boolean')).toBe('Deceased (boolean)');
  });
});

describe('getElementChildren', () => {
  it('should return children for Patient', () => {
    const children = getElementChildren(testProfiles, 'Patient');
    expect(children.length).toBeGreaterThan(0);
    expect(children[0].name).toBe('id');
  });

  it('should sort children by index', () => {
    const children = getElementChildren(testProfiles, 'Patient');
    for (let i = 1; i < children.length; i++) {
      expect(children[i].index).toBeGreaterThanOrEqual(children[i - 1].index);
    }
  });
});

describe('buildChildNode', () => {
  it('should build a simple value node', () => {
    const node = buildChildNode(testProfiles, 'value', 'Patient.gender', 'code');
    expect(node.name).toBe('gender');
    expect(node.fhirType).toBe('code');
    expect(node.nodeType).toBe('value');
    expect(node.value).toBe(true); // boolean type defaults to true
  });

  it('should build an object array node', () => {
    const node = buildChildNode(testProfiles, 'object', 'Patient.name', 'HumanName');
    expect(node.name).toBe('name');
    expect(node.nodeType).toBe('objectArray');
    expect(node.children).toBeDefined();
  });
});

describe('decorateFhirData', () => {
  beforeEach(() => {
    resetNextId();
  });

  it('should decorate a simple Patient resource', () => {
    const patient = {
      resourceType: 'Patient',
      id: '123',
      active: true,
      name: [{ family: 'Doe' }]
    };

    const decorated = decorateFhirData(testProfiles, patient);
    expect(decorated.name).toBe('Patient');
    expect(decorated.fhirType).toBe('DomainResource');
    expect(decorated.children).toBeDefined();
    expect(decorated.children!.length).toBeGreaterThan(0);
  });

  it('should decorate nested elements', () => {
    const patient = {
      resourceType: 'Patient',
      name: [{ given: ['John'] }]
    };

    const decorated = decorateFhirData(testProfiles, patient);
    const nameChild = decorated.children?.find(c => c.name === 'name');
    expect(nameChild).toBeDefined();
    expect(nameChild!.nodeType).toBe('objectArray');
  });

  it('should assign unique IDs', () => {
    const patient = {
      resourceType: 'Patient',
      active: true
    };

    const decorated = decorateFhirData(testProfiles, patient);
    const ids = new Set<number>();
    const collectIds = (node: DecoratedNode) => {
      ids.add(node.id);
      node.children?.forEach(collectIds);
    };
    collectIds(decorated);
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('toFhir', () => {
  beforeEach(() => {
    resetNextId();
  });

  it('should convert decorated node back to FHIR', () => {
    const patient = {
      resourceType: 'Patient',
      id: '123',
      active: true
    };

    const decorated = decorateFhirData(testProfiles, patient);
    const fhir = toFhir(decorated);

    expect(fhir.resourceType).toBe('Patient');
    expect(fhir.id).toBe('123');
    expect(fhir.active).toBe(true);
  });

  it('should validate and return error count', () => {
    const patient = {
      resourceType: 'Patient',
      active: 'not-a-boolean'  // Invalid
    };

    const decorated = decorateFhirData(testProfiles, patient);
    const [fhir, errCount] = toFhir(decorated, true) as [any, number];

    expect(fhir.resourceType).toBe('Patient');
    expect(errCount).toBeGreaterThan(0);
  });

  it('should handle arrays', () => {
    const patient = {
      resourceType: 'Patient',
      name: [
        { family: 'Smith' },
        { family: 'Jones' }
      ]
    };

    const decorated = decorateFhirData(testProfiles, patient);
    const fhir = toFhir(decorated);

    expect(Array.isArray(fhir.name)).toBe(true);
    expect(fhir.name.length).toBe(2);
  });
});
