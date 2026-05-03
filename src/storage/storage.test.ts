import { describe, it, expect, beforeEach, vi } from 'vitest';
import { load } from './load';
import { save } from './save';
import type { StoredData, } from '@/types/storage';
import { CURRENT_VERSION } from '@/types/storage';
import type { Template } from '@/types/template';

// jsdom provides localStorage globally
beforeEach(() => {
  localStorage.clear();
});

const emptyData: Omit<StoredData, 'version'> = { templates: {}, instances: {} };

describe('storage: round-trip', () => {
  it('save then load returns equal data', () => {
    save(emptyData);
    const result = load();
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.templates).toEqual({});
    expect(result.instances).toEqual({});
  });

  it('save then load preserves templates and instances', () => {
    const template = {
      id: 't1',
      title: 'Test',
      fields: [],
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
    };
    save({ templates: { t1: template }, instances: {} });
    const result = load();
    expect(result.templates.t1).toEqual(template);
  });
});

describe('storage: empty localStorage', () => {
  it('returns empty state when localStorage has no data', () => {
    const result = load();
    expect(result.templates).toEqual({});
    expect(result.instances).toEqual({});
    expect(result.invalidTemplateIds.size).toBe(0);
  });
});

describe('storage: future version throws', () => {
  it('throws when stored version is newer than CURRENT_VERSION', () => {
    const futureData = JSON.stringify({
      version: CURRENT_VERSION + 99,
      templates: {},
      instances: {},
    });
    localStorage.setItem('formBuilder', futureData);
    expect(() => load()).toThrow();
  });
});

describe('storage: malformed JSON', () => {
  it('returns empty state on JSON parse failure', () => {
    localStorage.setItem('formBuilder', 'not-json{{{');
    const result = load();
    expect(result.templates).toEqual({});
    expect(result.instances).toEqual({});
  });
});

describe('storage: cycle re-validation on load (P3)', () => {
  it('quarantines template with A→B→A cycle', () => {
    const cyclicTemplate: Template = {
      id: 'cyclic',
      title: 'Cyclic',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
      fields: [
        {
          id: 'a',
          type: 'text',
          label: 'A',
          conditions: [{ targetId: 'b', operator: 'text_equals', value: 'x', effect: 'show' }],
          conditionLogic: 'OR',
          defaultVisible: true,
          defaultRequired: false,
          config: {},
        },
        {
          id: 'b',
          type: 'text',
          label: 'B',
          conditions: [{ targetId: 'a', operator: 'text_equals', value: 'x', effect: 'show' }],
          conditionLogic: 'OR',
          defaultVisible: false,
          defaultRequired: false,
          config: {},
        },
      ],
    };

    const stored = JSON.stringify({
      version: CURRENT_VERSION,
      templates: { cyclic: cyclicTemplate },
      instances: {},
    });
    localStorage.setItem('formBuilder', stored);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = load();
    warnSpy.mockRestore();

    expect(result.invalidTemplateIds.has('cyclic')).toBe(true);
  });

  it('valid template is not quarantined', () => {
    const validTemplate: Template = {
      id: 'valid',
      title: 'Valid',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
      fields: [
        {
          id: 'a',
          type: 'text',
          label: 'A',
          conditions: [],
          conditionLogic: 'OR',
          defaultVisible: true,
          defaultRequired: false,
          config: {},
        },
      ],
    };

    save({ templates: { valid: validTemplate }, instances: {} });
    const result = load();
    expect(result.invalidTemplateIds.has('valid')).toBe(false);
  });
});
