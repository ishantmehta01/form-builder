import type { Template, Values } from '@/types/template';
import type { Effect } from '@/types/condition';
import type { Registry } from '@/registry/contract';
import { buildConditionGraph, topologicalSort } from './graph';
import { evaluateOperator } from './operators';

export interface EngineResult {
  computedValues: Values;
  visibility: Record<string, boolean>;
  required: Record<string, boolean>;
}

export function evaluate(
  rawValues: Values,
  template: Template,
  registry: Registry,
): EngineResult {
  // Pass 1 — Calculation. Aggregate raw values, no visibility filtering (B2 dropped).
  const computedValues: Values = { ...rawValues };
  for (const field of template.fields) {
    if (field.type !== 'calculation') continue;
    const sourceValues = field.config.sourceFieldIds
      .map((id) => rawValues[id])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (sourceValues.length === 0) continue;
    computedValues[field.id] = aggregate(sourceValues, field.config.aggregation);
  }

  // Pass 2 — Conditions in topological order with effective-value stripping.
  const fieldIds = template.fields.map((f) => f.id);
  const graph = buildConditionGraph(template);

  let order: string[];
  try {
    order = topologicalSort(graph, fieldIds);
  } catch {
    // Cycle detected — engine last-resort fallback. Return all-default visibility/required.
    console.error('[engine] Cycle detected in condition graph — falling back to defaults');
    const visibility: Record<string, boolean> = {};
    const required: Record<string, boolean> = {};
    for (const field of template.fields) {
      visibility[field.id] = field.defaultVisible;
      required[field.id] = 'defaultRequired' in field ? field.defaultRequired : false;
    }
    return { computedValues, visibility, required };
  }

  const effectiveValues: Values = { ...computedValues };
  const visibility: Record<string, boolean> = {};
  const required: Record<string, boolean> = {};

  const fieldMap = new Map(template.fields.map((f) => [f.id, f]));

  for (const fieldId of order) {
    const field = fieldMap.get(fieldId);
    if (!field) continue;

    const effects: Record<Effect, boolean[]> = {
      show: [],
      hide: [],
      require: [],
      not_require: [],
    };

    for (const cond of field.conditions) {
      const targetValue = effectiveValues[cond.targetId];
      const result = evaluateOperator(cond, targetValue);
      effects[cond.effect].push(result);
    }

    const combine =
      field.conditionLogic === 'AND'
        ? (arr: boolean[]) => arr.every(Boolean)
        : (arr: boolean[]) => arr.some(Boolean);

    // Empty groups are inactive — guard with length > 0
    const fires = (arr: boolean[]) => arr.length > 0 && combine(arr);

    const showFires = fires(effects.show);
    const hideFires = fires(effects.hide);
    const requireFires = fires(effects.require);
    const notRequireFires = fires(effects.not_require);

    let isVisible: boolean;
    if (hideFires) isVisible = false;
    else if (showFires) isVisible = true;
    else isVisible = field.defaultVisible;
    visibility[fieldId] = isVisible;

    const capturesValue = registry[field.type].capturesValue;
    if (!capturesValue || field.type === 'calculation' || field.type === 'section_header') {
      required[fieldId] = false;
    } else if (notRequireFires) {
      required[fieldId] = false;
    } else if (requireFires) {
      required[fieldId] = true;
    } else {
      required[fieldId] = 'defaultRequired' in field ? field.defaultRequired : false;
    }

    // Strip hidden field's effective value so downstream conditions see it as absent
    if (!isVisible) {
      delete effectiveValues[fieldId];
    }
  }

  return { computedValues, visibility, required };
}

function aggregate(
  values: number[],
  type: 'sum' | 'average' | 'min' | 'max',
): number {
  switch (type) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'average':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
  }
}
