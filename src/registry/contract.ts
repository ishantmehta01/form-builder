import type { JSX } from 'react';
import type { Field, FieldType } from '@/types/field';
import type { ConditionOperator, ValidatorContext, ValidationError } from '@/types/condition';

export interface FieldRendererProps<F extends Field> {
  field: F;
  value: unknown;
  onChange: (next: unknown) => void;
  isRequired: boolean;
  errors: ValidationError[];
  disabled?: boolean;
}

export interface ConfigEditorProps<F extends Field> {
  config: F['config'];
  onChange: (next: F['config']) => void;
  allFields: Field[];
  ownerFieldId: string;
}

export interface FieldTypeModule<F extends Field = Field> {
  type: F['type'];
  valueType: 'string' | 'number' | 'string[]' | 'date' | 'file[]' | 'none';
  capturesValue: boolean;
  canBeCalcSource: boolean;
  operators: ConditionOperator[];

  defaultConfig: F['config'];

  renderer: (props: FieldRendererProps<F>) => JSX.Element | null;
  configEditor: (props: ConfigEditorProps<F>) => JSX.Element | null;
  validator: (value: unknown, config: F['config'], ctx: ValidatorContext) => ValidationError[];
  pdfRenderer: (field: F, value: unknown) => JSX.Element | null;
  csvSerializer: (field: F, value: unknown) => string;
}

export type Registry = {
  [K in FieldType]: FieldTypeModule<Extract<Field, { type: K }>>;
};
