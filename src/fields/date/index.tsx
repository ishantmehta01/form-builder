import { useEffect } from 'react';
import type { FieldTypeModule } from '@/registry/contract';
import type { DateField } from '@/types/field';
import type { ValidationError } from '@/types/condition';
import { setOpt } from '@/lib/utils';

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function DateRenderer({ field, value, onChange, isRequired, errors, disabled }: Parameters<FieldTypeModule<DateField>['renderer']>[0]) {
  const str = typeof value === 'string' ? value : '';

  useEffect(() => {
    if (field.config.prefillToday && !str) {
      onChange(todayISO());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errorId = `field-${field.id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <input
        type="date"
        className="border rounded px-3 py-2 w-full"
        value={str}
        min={field.config.minDate}
        max={field.config.maxDate}
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

function DateConfigEditor({ config, onChange }: Parameters<FieldTypeModule<DateField>['configEditor']>[0]) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.prefillToday}
          onChange={(e) => onChange({ ...config, prefillToday: e.target.checked })}
        />
        Pre-fill with today&apos;s date
      </label>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Min date</label>
          <input
            type="date"
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.minDate ?? ''}
            onChange={(e) => onChange(setOpt(config, { minDate: e.target.value || undefined }))}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Max date</label>
          <input
            type="date"
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.maxDate ?? ''}
            onChange={(e) => onChange(setOpt(config, { maxDate: e.target.value || undefined }))}
          />
        </div>
      </div>
    </div>
  );
}

function validateDate(value: unknown, config: DateField['config'], ctx: { isRequired: boolean }): ValidationError[] {
  const errors: ValidationError[] = [];
  const str = typeof value === 'string' ? value : '';

  if (ctx.isRequired && !str) {
    errors.push({ rule: 'required', message: 'This field is required' });
  }
  if (str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      errors.push({ rule: 'invalid_format', message: 'Invalid date format' });
    } else {
      if (config.minDate && str < config.minDate) {
        errors.push({ rule: 'min_date', message: `Date must be on or after ${config.minDate}` });
      }
      if (config.maxDate && str > config.maxDate) {
        errors.push({ rule: 'max_date', message: `Date must be on or before ${config.maxDate}` });
      }
    }
  }
  return errors;
}

export const dateFieldModule: FieldTypeModule<DateField> = {
  type: 'date',
  valueType: 'date',
  capturesValue: true,
  canBeCalcSource: false,
  operators: ['date_equals', 'date_before', 'date_after'],
  defaultConfig: { prefillToday: false },
  renderer: DateRenderer,
  configEditor: DateConfigEditor,
  validator: validateDate,
  pdfRenderer: (field, value) => (
    <div className="print-field-row">
      <div className="font-semibold text-sm">{field.label}</div>
      <div className="text-sm">{typeof value === 'string' && value ? value : '—'}</div>
    </div>
  ),
  csvSerializer: (_field, value) => typeof value === 'string' ? value : '',
};
