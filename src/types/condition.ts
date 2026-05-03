export type Effect = 'show' | 'hide' | 'require' | 'not_require';

export interface ConditionMeta {
  targetId: string;
  effect: Effect;
}

export type Condition = ConditionMeta & (
  | { operator: 'text_equals'; value: string }
  | { operator: 'text_not_equals'; value: string }
  | { operator: 'text_contains'; value: string }
  | { operator: 'number_equals'; value: number }
  | { operator: 'number_gt'; value: number }
  | { operator: 'number_lt'; value: number }
  | { operator: 'number_within_range'; value: [number, number] }
  | { operator: 'select_equals'; value: string }
  | { operator: 'select_not_equals'; value: string }
  | { operator: 'multi_contains_any'; value: string[] }
  | { operator: 'multi_contains_all'; value: string[] }
  | { operator: 'multi_contains_none'; value: string[] }
  | { operator: 'date_equals'; value: string }
  | { operator: 'date_before'; value: string }
  | { operator: 'date_after'; value: string }
);

export type ConditionOperator = Condition['operator'];

export interface ValidatorContext {
  isRequired: boolean;
}

export interface ValidationError {
  rule:
    | 'required'
    | 'min_length'
    | 'max_length'
    | 'min'
    | 'max'
    | 'min_selections'
    | 'max_selections'
    | 'min_date'
    | 'max_date'
    | 'allowed_types'
    | 'max_files'
    | 'invalid_format';
  message: string;
}
