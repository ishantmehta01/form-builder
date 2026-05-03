export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'single_select'
  | 'multi_select'
  | 'file'
  | 'section_header'
  | 'calculation';

import type { Condition } from './condition';

export interface BaseFieldShared {
  id: string;
  label: string;
  conditions: Condition[];
  conditionLogic: 'AND' | 'OR';
  defaultVisible: boolean;
}

export interface RequirableFieldBase extends BaseFieldShared {
  defaultRequired: boolean;
}

export interface SelectOption {
  id: string;
  label: string;
}

export interface FileMetadata {
  filename: string;
  size: number;
  type: string;
}

export interface TextField extends RequirableFieldBase {
  type: 'text';
  config: {
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    prefix?: string;
    suffix?: string;
  };
}

export interface TextareaField extends RequirableFieldBase {
  type: 'textarea';
  config: {
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    rows?: number;
  };
}

export interface NumberField extends RequirableFieldBase {
  type: 'number';
  config: {
    min?: number;
    max?: number;
    decimalPlaces: 0 | 1 | 2 | 3 | 4;
    prefix?: string;
    suffix?: string;
  };
}

export interface DateField extends RequirableFieldBase {
  type: 'date';
  config: {
    prefillToday: boolean;
    minDate?: string;
    maxDate?: string;
  };
}

export interface SingleSelectField extends RequirableFieldBase {
  type: 'single_select';
  config: {
    options: SelectOption[];
    displayType: 'radio' | 'dropdown' | 'tiles';
  };
}

export interface MultiSelectField extends RequirableFieldBase {
  type: 'multi_select';
  config: {
    options: SelectOption[];
    minSelections?: number;
    maxSelections?: number;
  };
}

export interface FileField extends RequirableFieldBase {
  type: 'file';
  config: {
    allowedTypes: string[];
    maxFiles: number;
  };
}

export interface SectionHeaderField extends BaseFieldShared {
  type: 'section_header';
  config: {
    size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };
}

export interface CalculationField extends BaseFieldShared {
  type: 'calculation';
  config: {
    sourceFieldIds: string[];
    aggregation: 'sum' | 'average' | 'min' | 'max';
    decimalPlaces: 0 | 1 | 2 | 3 | 4;
  };
}

export type Field =
  | TextField
  | TextareaField
  | NumberField
  | DateField
  | SingleSelectField
  | MultiSelectField
  | FileField
  | SectionHeaderField
  | CalculationField;
