import type { Template, Values } from '@/types/template';
import type { ValidationError, ValidatorContext } from '@/types/condition';
import type { Registry } from '@/registry/contract';
import type { EngineResult } from './evaluate';

type GenericValidator = (value: unknown, config: never, ctx: ValidatorContext) => ValidationError[];

export function validateForm(
  template: Template,
  values: Values,
  engineResult: EngineResult,
  registry: Registry,
): Record<string, ValidationError[]> {
  const errors: Record<string, ValidationError[]> = {};

  for (const field of template.fields) {
    if (!registry[field.type].capturesValue) continue;
    if (engineResult.visibility[field.id] === false) continue;

    const validator = registry[field.type].validator as GenericValidator;
    const fieldErrors = validator(
      values[field.id],
      field.config as never,
      { isRequired: engineResult.required[field.id] ?? false },
    );

    if (fieldErrors.length > 0) {
      errors[field.id] = fieldErrors;
    }
  }

  return errors;
}
