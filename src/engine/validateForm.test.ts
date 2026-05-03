import { describe, it, expect, vi } from 'vitest';
import { validateForm } from './validateForm';
import type { Template } from '@/types/template';
import type { ValidationError } from '@/types/condition';
import type { EngineResult } from './evaluate';

function makeEngineResult(
  visibility: Record<string, boolean>,
  required: Record<string, boolean> = {},
): EngineResult {
  return { computedValues: {}, visibility, required };
}

function makeTemplate(fields: Template['fields']): Template {
  return {
    id: 't',
    title: 'T',
    fields,
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
  };
}

const requiredError: ValidationError = { rule: 'required', message: 'Required' };
const minLengthError: ValidationError = { rule: 'min_length', message: 'Too short' };

function makeRegistry(validators: Record<string, (value: unknown, _config: unknown, ctx: { isRequired: boolean }) => ValidationError[]>) {
  const base = {
    text: { capturesValue: true, validator: validators.text ?? (() => []) },
    textarea: { capturesValue: true, validator: () => [] },
    number: { capturesValue: true, validator: () => [] },
    date: { capturesValue: true, validator: () => [] },
    single_select: { capturesValue: true, validator: () => [] },
    multi_select: { capturesValue: true, validator: () => [] },
    file: { capturesValue: true, validator: () => [] },
    section_header: { capturesValue: false, validator: () => [] },
    calculation: { capturesValue: true, validator: () => [] },
  };
  return { ...base, ...Object.fromEntries(Object.entries(validators).map(([k, v]) => [k, { capturesValue: k !== 'section_header', validator: v }])) } as unknown as Parameters<typeof validateForm>[3];
}

describe('validateForm', () => {
  it('hidden field is skipped even if required', () => {
    const template = makeTemplate([{
      id: 'a', type: 'text', label: 'A', conditions: [], conditionLogic: 'OR',
      defaultVisible: false, defaultRequired: true, config: {},
    }]);
    const registry = makeRegistry({
      text: (_v, _c, ctx) => ctx.isRequired ? [requiredError] : [],
    });
    const result = validateForm(template, {}, makeEngineResult({ a: false }, { a: true }), registry);
    expect(result.a).toBeUndefined();
  });

  it('section header is skipped (capturesValue=false)', () => {
    const template = makeTemplate([{
      id: 'h', type: 'section_header', label: 'H', conditions: [], conditionLogic: 'OR',
      defaultVisible: true, config: { size: 'md' },
    }]);
    const spy = vi.fn(() => []);
    const registry = { ...makeRegistry({}), section_header: { capturesValue: false, validator: spy } } as unknown as Parameters<typeof validateForm>[3];
    validateForm(template, {}, makeEngineResult({ h: true }), registry);
    expect(spy).not.toHaveBeenCalled();
  });

  it('required-empty field produces required error', () => {
    const template = makeTemplate([{
      id: 'a', type: 'text', label: 'A', conditions: [], conditionLogic: 'OR',
      defaultVisible: true, defaultRequired: true, config: {},
    }]);
    const registry = makeRegistry({
      text: (_v, _c, ctx) => ctx.isRequired && !_v ? [requiredError] : [],
    });
    const result = validateForm(template, {}, makeEngineResult({ a: true }, { a: true }), registry);
    expect(result.a).toEqual([requiredError]);
  });

  it('multiple errors per field (required + min_length both fire)', () => {
    const template = makeTemplate([{
      id: 'a', type: 'text', label: 'A', conditions: [], conditionLogic: 'OR',
      defaultVisible: true, defaultRequired: true, config: {},
    }]);
    const registry = makeRegistry({
      text: (_v, _c, ctx) => ctx.isRequired ? [requiredError, minLengthError] : [],
    });
    const result = validateForm(template, {}, makeEngineResult({ a: true }, { a: true }), registry);
    expect(result.a).toHaveLength(2);
    expect(result.a).toContain(requiredError);
    expect(result.a).toContain(minLengthError);
  });

  it('returns sparse map — valid fields have no entry', () => {
    const template = makeTemplate([
      {
        id: 'a', type: 'text', label: 'A', conditions: [], conditionLogic: 'OR',
        defaultVisible: true, defaultRequired: false, config: {},
      },
      {
        id: 'b', type: 'text', label: 'B', conditions: [], conditionLogic: 'OR',
        defaultVisible: true, defaultRequired: true, config: {},
      },
    ]);
    const registry = makeRegistry({
      text: (v, _c, ctx) => (ctx.isRequired && !v) ? [requiredError] : [],
    });
    const result = validateForm(template, { a: 'filled' }, makeEngineResult({ a: true, b: true }, { a: false, b: true }), registry);
    expect(result.a).toBeUndefined(); // valid
    expect(result.b).toEqual([requiredError]); // invalid
  });
});
