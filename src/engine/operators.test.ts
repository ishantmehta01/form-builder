import { describe, it, expect } from 'vitest';
import { evaluateOperator } from './operators';
import type { Condition } from '@/types/condition';

function cond(partial: Omit<Condition, 'targetId' | 'effect'>): Condition {
  return { targetId: 'x', effect: 'show', ...partial } as Condition;
}

describe('evaluateOperator — absent target returns false for all operators', () => {
  const absentCases: [Condition, string][] = [
    [cond({ operator: 'text_equals', value: '' }), 'text_equals'],
    [cond({ operator: 'text_not_equals', value: 'x' }), 'text_not_equals'],
    [cond({ operator: 'text_contains', value: 'x' }), 'text_contains'],
    [cond({ operator: 'number_equals', value: 0 }), 'number_equals'],
    [cond({ operator: 'number_gt', value: -1 }), 'number_gt'],
    [cond({ operator: 'number_lt', value: 999 }), 'number_lt'],
    [cond({ operator: 'number_within_range', value: [0, 999] }), 'number_within_range'],
    [cond({ operator: 'select_equals', value: 'opt1' }), 'select_equals'],
    [cond({ operator: 'select_not_equals', value: 'opt1' }), 'select_not_equals'],
    [cond({ operator: 'multi_contains_any', value: ['opt1'] }), 'multi_contains_any'],
    [cond({ operator: 'multi_contains_all', value: ['opt1'] }), 'multi_contains_all'],
    [cond({ operator: 'multi_contains_none', value: [] }), 'multi_contains_none'],
    [cond({ operator: 'date_equals', value: '2000-01-01' }), 'date_equals'],
    [cond({ operator: 'date_before', value: '9999-12-31' }), 'date_before'],
    [cond({ operator: 'date_after', value: '1900-01-01' }), 'date_after'],
  ];

  for (const [condition, label] of absentCases) {
    it(`${label}: undefined → false`, () => {
      expect(evaluateOperator(condition, undefined)).toBe(false);
    });
    it(`${label}: null → false`, () => {
      expect(evaluateOperator(condition, null)).toBe(false);
    });
  }
});

describe('text operators', () => {
  it('text_equals: case-insensitive', () => {
    expect(evaluateOperator(cond({ operator: 'text_equals', value: 'YES' }), 'yes')).toBe(true);
  });
  it('text_equals: trim both sides', () => {
    expect(evaluateOperator(cond({ operator: 'text_equals', value: ' yes ' }), 'yes ')).toBe(true);
  });
  it('text_equals: mismatch', () => {
    expect(evaluateOperator(cond({ operator: 'text_equals', value: 'no' }), 'yes')).toBe(false);
  });
  it('text_not_equals: true on mismatch', () => {
    expect(evaluateOperator(cond({ operator: 'text_not_equals', value: 'no' }), 'yes')).toBe(true);
  });
  it('text_not_equals: false on match (case-insensitive)', () => {
    expect(evaluateOperator(cond({ operator: 'text_not_equals', value: 'YES' }), 'yes')).toBe(false);
  });
  it('text_contains: case-insensitive substring', () => {
    expect(evaluateOperator(cond({ operator: 'text_contains', value: 'HELLO' }), 'say hello world')).toBe(true);
  });
  it('text_contains: false when absent', () => {
    expect(evaluateOperator(cond({ operator: 'text_contains', value: 'x' }), 'abc')).toBe(false);
  });
});

describe('number operators', () => {
  it('number_equals: exact match', () => {
    expect(evaluateOperator(cond({ operator: 'number_equals', value: 42 }), 42)).toBe(true);
  });
  it('number_equals: false on mismatch', () => {
    expect(evaluateOperator(cond({ operator: 'number_equals', value: 42 }), 43)).toBe(false);
  });
  it('number_gt: true when value > threshold', () => {
    expect(evaluateOperator(cond({ operator: 'number_gt', value: 10 }), 11)).toBe(true);
  });
  it('number_gt: false when equal (not strictly greater)', () => {
    expect(evaluateOperator(cond({ operator: 'number_gt', value: 10 }), 10)).toBe(false);
  });
  it('number_gt: raw value, not rounded — 99.9 > 99.9 is false', () => {
    expect(evaluateOperator(cond({ operator: 'number_gt', value: 99.9 }), 99.9)).toBe(false);
  });
  it('number_lt: true when value < threshold', () => {
    expect(evaluateOperator(cond({ operator: 'number_lt', value: 10 }), 9)).toBe(true);
  });
  it('number_within_range: inclusive lower bound', () => {
    expect(evaluateOperator(cond({ operator: 'number_within_range', value: [5, 10] }), 5)).toBe(true);
  });
  it('number_within_range: inclusive upper bound', () => {
    expect(evaluateOperator(cond({ operator: 'number_within_range', value: [5, 10] }), 10)).toBe(true);
  });
  it('number_within_range: inside', () => {
    expect(evaluateOperator(cond({ operator: 'number_within_range', value: [5, 10] }), 7)).toBe(true);
  });
  it('number_within_range: below range', () => {
    expect(evaluateOperator(cond({ operator: 'number_within_range', value: [5, 10] }), 4)).toBe(false);
  });
  it('number_within_range: above range', () => {
    expect(evaluateOperator(cond({ operator: 'number_within_range', value: [5, 10] }), 11)).toBe(false);
  });
});

describe('select operators', () => {
  it('select_equals: ID match', () => {
    expect(evaluateOperator(cond({ operator: 'select_equals', value: 'opt-a' }), 'opt-a')).toBe(true);
  });
  it('select_equals: false on different ID', () => {
    expect(evaluateOperator(cond({ operator: 'select_equals', value: 'opt-a' }), 'opt-b')).toBe(false);
  });
  it('select_not_equals: true on different ID', () => {
    expect(evaluateOperator(cond({ operator: 'select_not_equals', value: 'opt-a' }), 'opt-b')).toBe(true);
  });
  it('select_not_equals: false on same ID', () => {
    expect(evaluateOperator(cond({ operator: 'select_not_equals', value: 'opt-a' }), 'opt-a')).toBe(false);
  });
});

describe('multi_select operators', () => {
  it('multi_contains_any: true when at least one matches', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_any', value: ['a', 'b'] }), ['b', 'c'])).toBe(true);
  });
  it('multi_contains_any: false when none match', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_any', value: ['a'] }), ['b', 'c'])).toBe(false);
  });
  it('multi_contains_any: false when selection empty (absent)', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_any', value: ['a'] }), [])).toBe(false);
  });
  it('multi_contains_all: true when all match', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_all', value: ['a', 'b'] }), ['a', 'b', 'c'])).toBe(true);
  });
  it('multi_contains_all: false when some missing', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_all', value: ['a', 'b'] }), ['a'])).toBe(false);
  });
  it('multi_contains_none: true when no intersection', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_none', value: ['a'] }), ['b', 'c'])).toBe(true);
  });
  it('multi_contains_none: false when intersection exists', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_none', value: ['a', 'b'] }), ['b'])).toBe(false);
  });
  it('multi_contains_none: false when target is absent (uniform absent rule)', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_none', value: ['a'] }), undefined)).toBe(false);
  });
  it('multi_contains_none: false when selection empty', () => {
    expect(evaluateOperator(cond({ operator: 'multi_contains_none', value: ['a'] }), [])).toBe(false);
  });
});

describe('date operators', () => {
  it('date_equals: same date', () => {
    expect(evaluateOperator(cond({ operator: 'date_equals', value: '2024-06-15' }), '2024-06-15')).toBe(true);
  });
  it('date_before: lex compare, earlier date', () => {
    expect(evaluateOperator(cond({ operator: 'date_before', value: '2024-06-15' }), '2024-06-01')).toBe(true);
  });
  it('date_before: false on equal', () => {
    expect(evaluateOperator(cond({ operator: 'date_before', value: '2024-06-15' }), '2024-06-15')).toBe(false);
  });
  it('date_after: lex compare, later date', () => {
    expect(evaluateOperator(cond({ operator: 'date_after', value: '2024-06-01' }), '2024-06-15')).toBe(true);
  });
  it('date_after: false on equal', () => {
    expect(evaluateOperator(cond({ operator: 'date_after', value: '2024-06-15' }), '2024-06-15')).toBe(false);
  });
});
