import type { FieldTypeModule } from '@/registry/contract';
import type { TextField } from '@/types/field';
import type { ValidationError } from '@/types/condition';
import { AffixedInput } from '@/components/AffixedInput';
import { setOpt } from '@/lib/utils';

function TextRenderer({ field, value, onChange, isRequired, errors, disabled }: Parameters<FieldTypeModule<TextField>['renderer']>[0]) {
  const str = typeof value === 'string' ? value : '';
  const errorId = `field-${field.id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <AffixedInput
        type="text"
        value={str}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={field.config.placeholder}
        prefix={field.config.prefix}
        suffix={field.config.suffix}
        disabled={disabled}
        aria-required={isRequired}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length > 0 ? errorId : undefined}
      />
      {errors.length > 0 && (
        <div id={errorId} role="alert" data-testid={`field-error-${field.id}`}>
          {errors.map((e) => (
            <p key={e.rule} className="text-red-600 text-xs">{e.message}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function TextConfigEditor({ config, onChange }: Parameters<FieldTypeModule<TextField>['configEditor']>[0]) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
        <input
          className="border rounded px-2 py-1 w-full text-sm"
          value={config.placeholder ?? ''}
          onChange={(e) => onChange(setOpt(config, { placeholder: e.target.value || undefined }))}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Min length</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.minLength ?? ''}
            onChange={(e) => onChange(setOpt(config, { minLength: e.target.value ? parseInt(e.target.value) : undefined }))}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Max length</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.maxLength ?? ''}
            onChange={(e) => onChange(setOpt(config, { maxLength: e.target.value ? parseInt(e.target.value) : undefined }))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Prefix</label>
          <input
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.prefix ?? ''}
            onChange={(e) => onChange(setOpt(config, { prefix: e.target.value || undefined }))}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Suffix</label>
          <input
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.suffix ?? ''}
            onChange={(e) => onChange(setOpt(config, { suffix: e.target.value || undefined }))}
          />
        </div>
      </div>
    </div>
  );
}

function validateText(value: unknown, config: TextField['config'], ctx: { isRequired: boolean }): ValidationError[] {
  const errors: ValidationError[] = [];
  const str = typeof value === 'string' ? value : '';

  if (ctx.isRequired && str.trim() === '') {
    errors.push({ rule: 'required', message: 'This field is required' });
  }
  if (config.minLength !== undefined && str.length > 0 && str.length < config.minLength) {
    errors.push({ rule: 'min_length', message: `Minimum ${config.minLength} characters` });
  }
  if (config.maxLength !== undefined && str.length > config.maxLength) {
    errors.push({ rule: 'max_length', message: `Maximum ${config.maxLength} characters` });
  }
  return errors;
}

export const textFieldModule: FieldTypeModule<TextField> = {
  type: 'text',
  valueType: 'string',
  capturesValue: true,
  canBeCalcSource: false,
  operators: ['text_equals', 'text_not_equals', 'text_contains'],
  defaultConfig: {},
  renderer: TextRenderer,
  configEditor: TextConfigEditor,
  validator: validateText,
  pdfRenderer: (field, value) => (
    <div className="print-field-row">
      <div className="font-semibold text-sm">{field.label}</div>
      <div className="text-sm">{typeof value === 'string' && value ? value : '—'}</div>
    </div>
  ),
  csvSerializer: (_field, value) => typeof value === 'string' ? value : '',
};
