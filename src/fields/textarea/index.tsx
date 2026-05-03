import type { FieldTypeModule } from '@/registry/contract';
import type { TextareaField } from '@/types/field';
import type { ValidationError } from '@/types/condition';
import { setOpt } from '@/lib/utils';

function TextareaRenderer({ field, value, onChange, isRequired, errors, disabled }: Parameters<FieldTypeModule<TextareaField>['renderer']>[0]) {
  const str = typeof value === 'string' ? value : '';
  const errorId = `field-${field.id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <textarea
        className="border rounded px-3 py-2 w-full resize-none"
        value={str}
        rows={field.config.rows ?? 4}
        placeholder={field.config.placeholder}
        onChange={(e) => onChange(e.target.value || undefined)}
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

function TextareaConfigEditor({ config, onChange }: Parameters<FieldTypeModule<TextareaField>['configEditor']>[0]) {
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
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Rows</label>
        <input
          type="number"
          className="border rounded px-2 py-1 w-full text-sm"
          value={config.rows ?? 4}
          onChange={(e) => onChange(setOpt(config, { rows: parseInt(e.target.value) || 4 }))}
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
    </div>
  );
}

function validateTextarea(value: unknown, config: TextareaField['config'], ctx: { isRequired: boolean }): ValidationError[] {
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

export const textareaFieldModule: FieldTypeModule<TextareaField> = {
  type: 'textarea',
  valueType: 'string',
  capturesValue: true,
  canBeCalcSource: false,
  operators: ['text_equals', 'text_not_equals', 'text_contains'],
  defaultConfig: { rows: 4 },
  renderer: TextareaRenderer,
  configEditor: TextareaConfigEditor,
  validator: validateTextarea,
  pdfRenderer: (field, value) => (
    <div className="print-field-row">
      <div className="font-semibold text-sm">{field.label}</div>
      <div className="text-sm whitespace-pre-wrap">{typeof value === 'string' && value ? value : '—'}</div>
    </div>
  ),
  csvSerializer: (_field, value) => typeof value === 'string' ? value : '',
};
