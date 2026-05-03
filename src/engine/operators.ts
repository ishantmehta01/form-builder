import type { Condition } from '@/types/condition';

export function evaluateOperator(condition: Condition, targetValue: unknown): boolean {
  if (targetValue === undefined || targetValue === null) return false;

  switch (condition.operator) {
    case 'text_equals': {
      if (typeof targetValue !== 'string') return false;
      return targetValue.trim().toLowerCase() === condition.value.trim().toLowerCase();
    }
    case 'text_not_equals': {
      if (typeof targetValue !== 'string') return false;
      return targetValue.trim().toLowerCase() !== condition.value.trim().toLowerCase();
    }
    case 'text_contains': {
      if (typeof targetValue !== 'string') return false;
      return targetValue.trim().toLowerCase().includes(condition.value.trim().toLowerCase());
    }
    case 'number_equals': {
      if (typeof targetValue !== 'number' || !Number.isFinite(targetValue)) return false;
      return targetValue === condition.value;
    }
    case 'number_gt': {
      if (typeof targetValue !== 'number' || !Number.isFinite(targetValue)) return false;
      return targetValue > condition.value;
    }
    case 'number_lt': {
      if (typeof targetValue !== 'number' || !Number.isFinite(targetValue)) return false;
      return targetValue < condition.value;
    }
    case 'number_within_range': {
      if (typeof targetValue !== 'number' || !Number.isFinite(targetValue)) return false;
      const [min, max] = condition.value;
      return targetValue >= min && targetValue <= max;
    }
    case 'select_equals': {
      if (typeof targetValue !== 'string') return false;
      return targetValue === condition.value;
    }
    case 'select_not_equals': {
      if (typeof targetValue !== 'string') return false;
      return targetValue !== condition.value;
    }
    case 'multi_contains_any': {
      if (!Array.isArray(targetValue) || targetValue.length === 0) return false;
      return condition.value.some((id) => targetValue.includes(id));
    }
    case 'multi_contains_all': {
      if (!Array.isArray(targetValue) || targetValue.length === 0) return false;
      return condition.value.every((id) => targetValue.includes(id));
    }
    case 'multi_contains_none': {
      if (!Array.isArray(targetValue) || targetValue.length === 0) return false;
      return !condition.value.some((id) => targetValue.includes(id));
    }
    case 'date_equals': {
      if (typeof targetValue !== 'string') return false;
      return targetValue === condition.value;
    }
    case 'date_before': {
      if (typeof targetValue !== 'string') return false;
      return targetValue < condition.value;
    }
    case 'date_after': {
      if (typeof targetValue !== 'string') return false;
      return targetValue > condition.value;
    }
  }
}
