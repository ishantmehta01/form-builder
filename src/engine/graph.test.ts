import { describe, it, expect } from 'vitest';
import { buildConditionGraph, topologicalSort, findCycle } from './graph';
import type { Template } from '@/types/template';

function makeTemplate(fields: Template['fields']): Template {
  return {
    id: 't',
    title: 'Test',
    fields,
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
  };
}

function makeTextField(id: string, conditions: Template['fields'][0]['conditions'] = []) {
  return {
    id,
    type: 'text' as const,
    label: id,
    conditions,
    conditionLogic: 'OR' as const,
    defaultVisible: true,
    defaultRequired: false,
    config: {},
  };
}

describe('buildConditionGraph', () => {
  it('creates nodes for all fields with no conditions', () => {
    const template = makeTemplate([makeTextField('a'), makeTextField('b')]);
    const graph = buildConditionGraph(template);
    expect(graph.has('a')).toBe(true);
    expect(graph.has('b')).toBe(true);
    expect(graph.get('a')!.size).toBe(0);
    expect(graph.get('b')!.size).toBe(0);
  });

  it('adds edge from target to owner', () => {
    // B has condition targeting A → edge A → B
    const template = makeTemplate([
      makeTextField('a'),
      makeTextField('b', [{ targetId: 'a', effect: 'show', operator: 'text_equals', value: 'x' }]),
    ]);
    const graph = buildConditionGraph(template);
    expect(graph.get('a')!.has('b')).toBe(true);
    expect(graph.get('b')!.size).toBe(0);
  });

  it('handles multiple dependents on one target', () => {
    const template = makeTemplate([
      makeTextField('a'),
      makeTextField('b', [{ targetId: 'a', effect: 'show', operator: 'text_equals', value: 'x' }]),
      makeTextField('c', [{ targetId: 'a', effect: 'hide', operator: 'text_equals', value: 'y' }]),
    ]);
    const graph = buildConditionGraph(template);
    expect(graph.get('a')!.has('b')).toBe(true);
    expect(graph.get('a')!.has('c')).toBe(true);
  });

  it('handles chained dependencies', () => {
    const template = makeTemplate([
      makeTextField('a'),
      makeTextField('b', [{ targetId: 'a', effect: 'show', operator: 'text_equals', value: 'x' }]),
      makeTextField('c', [{ targetId: 'b', effect: 'show', operator: 'text_equals', value: 'y' }]),
    ]);
    const graph = buildConditionGraph(template);
    expect(graph.get('a')!.has('b')).toBe(true);
    expect(graph.get('b')!.has('c')).toBe(true);
  });
});

describe('topologicalSort', () => {
  it('returns all field IDs for no-dependency graph', () => {
    const graph = new Map([['a', new Set<string>()], ['b', new Set<string>()]]);
    const result = topologicalSort(graph, ['a', 'b']);
    expect(result.sort()).toEqual(['a', 'b'].sort());
  });

  it('returns target before owner (a before b, b before c)', () => {
    const graph = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['c'])],
      ['c', new Set<string>()],
    ]);
    const result = topologicalSort(graph, ['a', 'b', 'c']);
    expect(result.indexOf('a')).toBeLessThan(result.indexOf('b'));
    expect(result.indexOf('b')).toBeLessThan(result.indexOf('c'));
  });

  it('throws on cycle', () => {
    const graph = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['a'])],
    ]);
    expect(() => topologicalSort(graph, ['a', 'b'])).toThrow();
  });
});

describe('findCycle', () => {
  it('returns null for DAG', () => {
    const graph = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['c'])],
      ['c', new Set<string>()],
    ]);
    expect(findCycle(graph)).toBeNull();
  });

  it('detects A → B → A cycle', () => {
    const graph = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['a'])],
    ]);
    const cycle = findCycle(graph);
    expect(cycle).not.toBeNull();
    expect(cycle!.includes('a')).toBe(true);
    expect(cycle!.includes('b')).toBe(true);
  });

  it('detects longer cycle A → B → C → A', () => {
    const graph = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['c'])],
      ['c', new Set(['a'])],
    ]);
    const cycle = findCycle(graph);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThan(2);
  });

  it('returns null for disconnected nodes with no cycles', () => {
    const graph = new Map([
      ['a', new Set<string>()],
      ['b', new Set<string>()],
    ]);
    expect(findCycle(graph)).toBeNull();
  });
});
