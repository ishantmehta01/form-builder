import type { FieldTypeModule } from '@/registry/contract';
import type { NumberField } from '@/types/field';
import type { ValidationError } from '@/types/condition';
import { AffixedInput } from '@/components/AffixedInput';
import { setOpt } from '@/lib/utils';

function NumberRenderer({ field, value, onChange, isRequired, errors, disabled }: Parameters<FieldTypeModule<NumberField>['renderer']>[0]) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : '';
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <AffixedInput
        type="number"
        value={num === '' ? '' : String(num)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' || raw === '-') { onChange(undefined); return; }
          const n = parseFloat(raw);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        step={1 / Math.pow(10, field.config.decimalPlaces)}
        prefix={field.config.prefix}
        suffix={field.config.suffix}
        disabled={disabled}
        aria-required={isRequired}
        aria-invalid={errors.length > 0}
      />
      {errors.map((e) => (
        <p key={e.rule} className="text-red-600 text-xs">{e.message}</p>
      ))}
    </div>
  );
}

function NumberConfigEditor({ config, onChange }: Parameters<FieldTypeModule<NumberField>['configEditor']>[0]) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Decimal places</label>
        <select
          className="border rounded px-2 py-1 w-full text-sm"
          value={config.decimalPlaces}
          onChange={(e) => onChange({ ...config, decimalPlaces: parseInt(e.target.value) as 0 | 1 | 2 | 3 | 4 })}
        >
          {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Min</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.min ?? ''}
            onChange={(e) => onChange(setOpt(config, { min: e.target.value ? parseFloat(e.target.value) : undefined }))}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Max</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.max ?? ''}
            onChange={(e) => onChange(setOpt(config, { max: e.target.value ? parseFloat(e.target.value) : undefined }))}
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

function validateNumber(value: unknown, config: NumberField['config'], ctx: { isRequired: boolean }): ValidationError[] {
  const errors: ValidationError[] = [];
  const hasValue = typeof value === 'number' && Number.isFinite(value);

  if (ctx.isRequired && !hasValue) {
    errors.push({ rule: 'required', message: 'This field is required' });
  }
  if (hasValue) {
    const num = value as number;
    if (config.min !== undefined && num < config.min) {
      errors.push({ rule: 'min', message: `Minimum value is ${config.min}` });
    }
    if (config.max !== undefined && num > config.max) {
      errors.push({ rule: 'max', message: `Maximum value is ${config.max}` });
    }
  }
  return errors;
}

export const numberFieldModule: FieldTypeModule<NumberField> = {
  type: 'number',
  valueType: 'number',
  capturesValue: true,
  canBeCalcSource: true,
  operators: ['number_equals', 'number_gt', 'number_lt', 'number_within_range'],
  defaultConfig: { decimalPlaces: 0 },
  renderer: NumberRenderer,
  configEditor: NumberConfigEditor,
  validator: validateNumber,
  pdfRenderer: (field, value) => (
    <div className="print-field-row">
      <div className="font-semibold text-sm">{field.label}</div>
      <div className="text-sm">
        {typeof value === 'number' && Number.isFinite(value)
          ? `${field.config.prefix ?? ''}${value.toFixed(field.config.decimalPlaces)}${field.config.suffix ?? ''}`
          : '—'}
      </div>
    </div>
  ),
  csvSerializer: (field, value) =>
    typeof value === 'number' && Number.isFinite(value)
      ? value.toFixed(field.config.decimalPlaces)
      : '',
};
