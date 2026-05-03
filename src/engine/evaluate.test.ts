import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluate';
import type { Template } from '@/types/template';
import type { Field } from '@/types/field';

// Minimal registry stub — engine only reads capturesValue from registry
const stubRegistry = {
  text: { capturesValue: true, validator: () => [] },
  textarea: { capturesValue: true, validator: () => [] },
  number: { capturesValue: true, validator: () => [] },
  date: { capturesValue: true, validator: () => [] },
  single_select: { capturesValue: true, validator: () => [] },
  multi_select: { capturesValue: true, validator: () => [] },
  file: { capturesValue: true, validator: () => [] },
  section_header: { capturesValue: false, validator: () => [] },
  calculation: { capturesValue: true, validator: () => [] },
} as unknown as Parameters<typeof evaluate>[2];

function makeTemplate(fields: Field[]): Template {
  return {
    id: 't',
    title: 'Test',
    fields,
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
  };
}

function textField(id: string, overrides: Partial<Field> = {}): Field {
  return {
    id,
    type: 'text',
    label: id,
    conditions: [],
    conditionLogic: 'OR',
    defaultVisible: true,
    defaultRequired: false,
    config: {},
    ...overrides,
  } as Field;
}

function numberField(id: string, overrides: Partial<Field> = {}): Field {
  return {
    id,
    type: 'number',
    label: id,
    conditions: [],
    conditionLogic: 'OR',
    defaultVisible: true,
    defaultRequired: false,
    config: { decimalPlaces: 0 as const },
    ...overrides,
  } as Field;
}

function calcField(id: string, sourceFieldIds: string[], aggregation: 'sum' | 'average' | 'min' | 'max' = 'sum'): Field {
  return {
    id,
    type: 'calculation',
    label: id,
    conditions: [],
    conditionLogic: 'OR',
    defaultVisible: true,
    config: { sourceFieldIds, aggregation, decimalPlaces: 0 as const },
  } as Field;
}

// ────────────────────────────────────────────────────────────────
// Cascade test — HEADLINE CORRECTNESS TEST
// ────────────────────────────────────────────────────────────────
describe('cascade through hidden-but-preserved values', () => {
  it('strips hidden upstream values so downstream conditions see them as absent', () => {
    const template = makeTemplate([
      textField('a'),
      textField('b', {
        conditions: [{ targetId: 'a', operator: 'text_equals', value: 'show', effect: 'show' }],
        defaultVisible: false,
      }),
      textField('c', {
        conditions: [{ targetId: 'b', operator: 'text_equals', value: 'blue', effect: 'show' }],
        defaultVisible: false,
      }),
    ]);

    // A='hide' so B stays hidden. B has preserved value 'blue', but must be stripped.
    const result = evaluate({ a: 'hide', b: 'blue' }, template, stubRegistry);

    expect(result.visibility.a).toBe(true);
    expect(result.visibility.b).toBe(false);
    // CASCADE: C must be hidden even though raw b='blue' still in rawValues
    expect(result.visibility.c).toBe(false);
  });

  it('shows C when chain is intact (A=show → B visible → C visible)', () => {
    const template = makeTemplate([
      textField('a'),
      textField('b', {
        conditions: [{ targetId: 'a', operator: 'text_equals', value: 'show', effect: 'show' }],
        defaultVisible: false,
      }),
      textField('c', {
        conditions: [{ targetId: 'b', operator: 'text_equals', value: 'blue', effect: 'show' }],
        defaultVisible: false,
      }),
    ]);

    const result = evaluate({ a: 'show', b: 'blue' }, template, stubRegistry);

    expect(result.visibility.a).toBe(true);
    expect(result.visibility.b).toBe(true);
    expect(result.visibility.c).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// B2 dropped — calc aggregates over all sources regardless of visibility
// ────────────────────────────────────────────────────────────────
describe('B2 dropped: calc aggregates all sources regardless of visibility', () => {
  it('sum includes hidden source values', () => {
    const template = makeTemplate([
      textField('trigger'),
      numberField('n1', {
        conditions: [{ targetId: 'trigger', operator: 'text_equals', value: 'hide', effect: 'hide' }],
      }),
      numberField('n2'),
      calcField('total', ['n1', 'n2'], 'sum'),
    ]);

    const result = evaluate({ trigger: 'hide', n1: 10, n2: 20 }, template, stubRegistry);

    expect(result.visibility.n1).toBe(false);
    expect(result.computedValues.total).toBe(30); // B2 dropped: includes hidden n1=10
  });
});

// ────────────────────────────────────────────────────────────────
// Calculation tests
// ────────────────────────────────────────────────────────────────
describe('calculation', () => {
  it('all-empty sources: calc value omitted from computedValues', () => {
    const template = makeTemplate([numberField('n1'), calcField('total', ['n1'])]);
    const result = evaluate({}, template, stubRegistry);
    expect(result.computedValues.total).toBeUndefined();
  });

  it('single-source calc: value equals source', () => {
    const template = makeTemplate([numberField('n1'), calcField('total', ['n1'])]);
    const result = evaluate({ n1: 42 }, template, stubRegistry);
    expect(result.computedValues.total).toBe(42);
  });

  it('sum aggregation', () => {
    const template = makeTemplate([numberField('a'), numberField('b'), calcField('total', ['a', 'b'], 'sum')]);
    const result = evaluate({ a: 3, b: 7 }, template, stubRegistry);
    expect(result.computedValues.total).toBe(10);
  });

  it('average aggregation', () => {
    const template = makeTemplate([numberField('a'), numberField('b'), calcField('avg', ['a', 'b'], 'average')]);
    const result = evaluate({ a: 4, b: 8 }, template, stubRegistry);
    expect(result.computedValues.avg).toBe(6);
  });

  it('min aggregation', () => {
    const template = makeTemplate([numberField('a'), numberField('b'), calcField('mn', ['a', 'b'], 'min')]);
    const result = evaluate({ a: 4, b: 8 }, template, stubRegistry);
    expect(result.computedValues.mn).toBe(4);
  });

  it('max aggregation', () => {
    const template = makeTemplate([numberField('a'), numberField('b'), calcField('mx', ['a', 'b'], 'max')]);
    const result = evaluate({ a: 4, b: 8 }, template, stubRegistry);
    expect(result.computedValues.mx).toBe(8);
  });

  it('calc as condition target: condition fires on calc value', () => {
    const template = makeTemplate([
      numberField('n1'),
      calcField('total', ['n1'], 'sum'),
      textField('msg', {
        conditions: [{ targetId: 'total', operator: 'number_gt', value: 100, effect: 'show' }],
        defaultVisible: false,
      }),
    ]);

    const result = evaluate({ n1: 150 }, template, stubRegistry);
    expect(result.computedValues.total).toBe(150);
    expect(result.visibility.msg).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// AND / OR combination
// ────────────────────────────────────────────────────────────────
describe('AND / OR condition combination', () => {
  it('AND: both must match', () => {
    const template = makeTemplate([
      textField('a'),
      textField('b'),
      textField('c', {
        conditions: [
          { targetId: 'a', operator: 'text_equals', value: 'yes', effect: 'show' },
          { targetId: 'b', operator: 'text_equals', value: 'yes', effect: 'show' },
        ],
        conditionLogic: 'AND',
        defaultVisible: false,
      }),
    ]);

    const onlyA = evaluate({ a: 'yes', b: 'no' }, template, stubRegistry);
    expect(onlyA.visibility.c).toBe(false);

    const both = evaluate({ a: 'yes', b: 'yes' }, template, stubRegistry);
    expect(both.visibility.c).toBe(true);
  });

  it('OR: either matches', () => {
    const template = makeTemplate([
      textField('a'),
      textField('b'),
      textField('c', {
        conditions: [
          { targetId: 'a', operator: 'text_equals', value: 'yes', effect: 'show' },
          { targetId: 'b', operator: 'text_equals', value: 'yes', effect: 'show' },
        ],
        conditionLogic: 'OR',
        defaultVisible: false,
      }),
    ]);

    const onlyA = evaluate({ a: 'yes', b: 'no' }, template, stubRegistry);
    expect(onlyA.visibility.c).toBe(true);

    const neither = evaluate({ a: 'no', b: 'no' }, template, stubRegistry);
    expect(neither.visibility.c).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// Precedence
// ────────────────────────────────────────────────────────────────
describe('precedence', () => {
  it('Hide wins over Show when both fire', () => {
    const template = makeTemplate([
      textField('trigger'),
      textField('b', {
        conditions: [
          { targetId: 'trigger', operator: 'text_equals', value: 'x', effect: 'show' },
          { targetId: 'trigger', operator: 'text_equals', value: 'x', effect: 'hide' },
        ],
        defaultVisible: true,
      }),
    ]);

    const result = evaluate({ trigger: 'x' }, template, stubRegistry);
    expect(result.visibility.b).toBe(false);
  });

  it('Not-Required wins over Required when both fire', () => {
    const template = makeTemplate([
      textField('trigger'),
      textField('b', {
        conditions: [
          { targetId: 'trigger', operator: 'text_equals', value: 'x', effect: 'require' },
          { targetId: 'trigger', operator: 'text_equals', value: 'x', effect: 'not_require' },
        ],
        defaultRequired: false,
      }),
    ]);

    const result = evaluate({ trigger: 'x' }, template, stubRegistry);
    expect(result.required.b).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// Default fallback
// ────────────────────────────────────────────────────────────────
describe('default fallback', () => {
  it('field with no matching conditions falls back to defaultVisible', () => {
    const template = makeTemplate([
      textField('a', { defaultVisible: false }),
    ]);
    const result = evaluate({}, template, stubRegistry);
    expect(result.visibility.a).toBe(false);
  });

  it('field with no matching conditions falls back to defaultRequired', () => {
    const template = makeTemplate([
      textField('a', { defaultRequired: true }),
    ]);
    const result = evaluate({}, template, stubRegistry);
    expect(result.required.a).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Forward references
// ────────────────────────────────────────────────────────────────
describe('forward references', () => {
  it('condition target appears later in array; engine resolves correctly by ID', () => {
    // C comes before B in array, but B is a condition target of C — forward ref
    const template = makeTemplate([
      textField('c', {
        conditions: [{ targetId: 'b', operator: 'text_equals', value: 'yes', effect: 'show' }],
        defaultVisible: false,
      }),
      textField('b'),
    ]);

    const result = evaluate({ b: 'yes' }, template, stubRegistry);
    expect(result.visibility.c).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Deep chain
// ────────────────────────────────────────────────────────────────
describe('deep chain', () => {
  it('A → B → C → D, four levels', () => {
    const template = makeTemplate([
      textField('a'),
      textField('b', {
        conditions: [{ targetId: 'a', operator: 'text_equals', value: 'yes', effect: 'show' }],
        defaultVisible: false,
      }),
      textField('c', {
        conditions: [{ targetId: 'b', operator: 'text_equals', value: 'yes', effect: 'show' }],
        defaultVisible: false,
      }),
      textField('d', {
        conditions: [{ targetId: 'c', operator: 'text_equals', value: 'yes', effect: 'show' }],
        defaultVisible: false,
      }),
    ]);

    // All active
    const r1 = evaluate({ a: 'yes', b: 'yes', c: 'yes' }, template, stubRegistry);
    expect(r1.visibility.d).toBe(true);

    // Break at B — C and D should cascade
    const r2 = evaluate({ a: 'no', b: 'yes', c: 'yes' }, template, stubRegistry);
    expect(r2.visibility.b).toBe(false);
    expect(r2.visibility.c).toBe(false);
    expect(r2.visibility.d).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// Stale condition (non-existent target)
// ────────────────────────────────────────────────────────────────
describe('stale condition', () => {
  it('skips condition with non-existent targetId — does not throw', () => {
    const template = makeTemplate([
      textField('a', {
        conditions: [{ targetId: 'nonexistent', operator: 'text_equals', value: 'x', effect: 'show' }],
        defaultVisible: true,
      }),
    ]);

    expect(() => evaluate({}, template, stubRegistry)).not.toThrow();
    const result = evaluate({}, template, stubRegistry);
    expect(result.visibility.a).toBe(true); // falls back to defaultVisible
  });
});

// ────────────────────────────────────────────────────────────────
// Section Header required always false
// ────────────────────────────────────────────────────────────────
describe('section_header required always false', () => {
  it('even if a require condition fires, section_header required is false', () => {
    const template = makeTemplate([
      textField('trigger'),
      {
        id: 'header',
        type: 'section_header',
        label: 'Header',
        conditions: [{ targetId: 'trigger', operator: 'text_equals', value: 'x', effect: 'require' }],
        conditionLogic: 'OR',
        defaultVisible: true,
        config: { size: 'md' },
      } as Field,
    ]);

    const result = evaluate({ trigger: 'x' }, template, stubRegistry);
    expect(result.required.header).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// Empty effect groups are inactive (P4)
// ────────────────────────────────────────────────────────────────
describe('empty effect groups are inactive (P4)', () => {
  it('field with no conditions uses defaultVisible, not vacuous Hide-wins', () => {
    const template = makeTemplate([
      textField('a', { defaultVisible: true, conditions: [] }),
    ]);
    const result = evaluate({}, template, stubRegistry);
    expect(result.visibility.a).toBe(true); // NOT hidden by empty hide group
  });

  it('field with one Show condition that does NOT fire falls back to defaultVisible', () => {
    const template = makeTemplate([
      textField('trigger'),
      textField('b', {
        conditions: [{ targetId: 'trigger', operator: 'text_equals', value: 'match', effect: 'show' }],
        defaultVisible: true,
        conditionLogic: 'AND',
      }),
    ]);
    // Condition doesn't fire, no Hide conditions → should fall back to defaultVisible=true
    const result = evaluate({ trigger: 'nomatch' }, template, stubRegistry);
    expect(result.visibility.b).toBe(true); // defaultVisible, NOT hidden by empty hide group
  });

  it('conditionLogic per-effect-group: Show-AND fails but Hide fires → hidden', () => {
    // Field has 2 Show conditions (AND) and 1 Hide condition
    const template = makeTemplate([
      textField('a'),
      textField('b'),
      textField('c'),
      textField('target', {
        conditions: [
          { targetId: 'a', operator: 'text_equals', value: 'yes', effect: 'show' },
          { targetId: 'b', operator: 'text_equals', value: 'yes', effect: 'show' },
          { targetId: 'c', operator: 'text_equals', value: 'hide', effect: 'hide' },
        ],
        conditionLogic: 'AND', // applies to Show group (requires both 'yes')
        defaultVisible: false,
      }),
    ]);

    // Show AND fails (only a matches), but Hide fires → hidden
    const result = evaluate({ a: 'yes', b: 'no', c: 'hide' }, template, stubRegistry);
    expect(result.visibility.target).toBe(false);
  });

  it('conditionLogic per-effect-group: Show-AND succeeds and Hide does not fire → visible', () => {
    const template = makeTemplate([
      textField('a'),
      textField('b'),
      textField('c'),
      textField('target', {
        conditions: [
          { targetId: 'a', operator: 'text_equals', value: 'yes', effect: 'show' },
          { targetId: 'b', operator: 'text_equals', value: 'yes', effect: 'show' },
          { targetId: 'c', operator: 'text_equals', value: 'hide', effect: 'hide' },
        ],
        conditionLogic: 'AND',
        defaultVisible: false,
      }),
    ]);

    // Show AND succeeds (both match), Hide doesn't fire (c !== 'hide') → visible
    const result = evaluate({ a: 'yes', b: 'yes', c: 'nope' }, template, stubRegistry);
    expect(result.visibility.target).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Cycle defense (P3)
// ────────────────────────────────────────────────────────────────
describe('cycle defense (P3)', () => {
  it('feeds known-cyclic template — engine does not throw', () => {
    // A→B→A cycle via conditions
    const template = makeTemplate([
      textField('a', {
        conditions: [{ targetId: 'b', operator: 'text_equals', value: 'x', effect: 'show' }],
        defaultVisible: true,
      }),
      textField('b', {
        conditions: [{ targetId: 'a', operator: 'text_equals', value: 'x', effect: 'show' }],
        defaultVisible: false,
      }),
    ]);

    expect(() => evaluate({ a: 'x', b: 'x' }, template, stubRegistry)).not.toThrow();
  });

  it('cycle defense returns all-default visibility', () => {
    const template = makeTemplate([
      textField('a', {
        conditions: [{ targetId: 'b', operator: 'text_equals', value: 'x', effect: 'show' }],
        defaultVisible: true,
      }),
      textField('b', {
        conditions: [{ targetId: 'a', operator: 'text_equals', value: 'x', effect: 'show' }],
        defaultVisible: false,
      }),
    ]);

    const result = evaluate({}, template, stubRegistry);
    expect(result.visibility.a).toBe(true);  // defaultVisible
    expect(result.visibility.b).toBe(false); // defaultVisible
  });
});
