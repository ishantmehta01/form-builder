import type { Field } from './field';

export type Values = Record<string, unknown>;

export interface Template {
  id: string;
  title: string;
  fields: Field[];
  createdAt: string;
  modifiedAt: string;
}

export interface Instance {
  id: string;
  templateId: string;
  templateSnapshot: Template;
  values: Values;
  visibility: Record<string, boolean>;
  submittedAt: string;
}
