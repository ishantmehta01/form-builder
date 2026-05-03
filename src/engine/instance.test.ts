import { describe, it, expect } from 'vitest';
import { evaluate } from '@/engine/evaluate';
import { registry } from '@/registry';
import type { Template, Values } from '@/types/template';

function makeLifecycleTemplate(): Template {
  return {
    id: 'p1',
    title: 'P1 Lifecycle',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    fields: [
      {
        id: 'trigger',
        type: 'text',
        label: 'Trigger',
        conditions: [],
        conditionLogic: 'OR',
        defaultVisible: true,
        defaultRequired: false,
        config: {},
      },
      {
        id: 'A',
        type: 'number',
        label: 'A',
        conditions: [],
        conditionLogic: 'OR',
        defaultVisible: true,
        defaultRequired: false,
        config: { decimalPlaces: 0 },
      },
      {
        id: 'B',
        type: 'number',
        label: 'B',
        conditions: [],
        conditionLogic: 'OR',
        defaultVisible: true,
        defaultRequired: false,
        config: { decimalPlaces: 0 },
      },
      {
        id: 'C',
        type: 'number',
        label: 'C',
        conditions: [
          { targetId: 'trigger', effect: 'hide', operator: 'text_equals', value: 'hide' },
        ],
        conditionLogic: 'OR',
        defaultVisible: true,
        defaultRequired: false,
        config: { decimalPlaces: 0 },
      },
      {
        id: 'T',
        type: 'calculation',
        label: 'Total',
        conditions: [],
        conditionLogic: 'OR',
        defaultVisible: true,
        config: { sourceFieldIds: ['A', 'B', 'C'], aggregation: 'sum', decimalPlaces: 0 },
      },
    ],
  };
}

describe('P1 instance lifecycle', () => {
  const template = makeLifecycleTemplate();

  it('calc preserves value when a source field is hidden (T=60 not 30)', () => {
    // C is hidden (trigger='hide'), but T=sum(A,B,C) still uses raw C=30
    const raw: Values = { trigger: 'hide', A: 10, B: 20, C: 30 };
    const result = evaluate(raw, template, registry);

    expect(result.visibility['C']).toBe(false);
    expect(result.computedValues['T']).toBe(60);
  });

  it('visibility map covers every field in template', () => {
    const raw: Values = { A: 1, B: 2, C: 3 };
    const result = evaluate(raw, template, registry);

    for (const field of template.fields) {
      expect(result.visibility).toHaveProperty(field.id);
      expect(typeof result.visibility[field.id]).toBe('boolean');
    }
  });

  it('visible-but-empty field is distinct from hidden field', () => {
    // trigger='hide' → C is hidden; A is visible but has no value
    const raw: Values = { trigger: 'hide' };
    const result = evaluate(raw, template, registry);

    expect(result.visibility['C']).toBe(false);      // hidden
    expect(result.visibility['A']).toBe(true);        // visible
    expect(result.computedValues['A']).toBeUndefined(); // visible but empty
  });
});
