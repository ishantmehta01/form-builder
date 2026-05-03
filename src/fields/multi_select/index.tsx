import type { FieldTypeModule } from '@/registry/contract';
import type { MultiSelectField } from '@/types/field';
import type { ValidationError } from '@/types/condition';
import { setOpt } from '@/lib/utils';

function MultiSelectRenderer({ field, value, onChange, isRequired, errors, disabled }: Parameters<FieldTypeModule<MultiSelectField>['renderer']>[0]) {
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
  const { options } = field.config;

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(next.length > 0 ? next : undefined);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(opt.id)}
              onChange={() => toggle(opt.id)}
              disabled={disabled}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {errors.map((e) => (
        <p key={e.rule} className="text-red-600 text-xs">{e.message}</p>
      ))}
    </div>
  );
}

function MultiSelectConfigEditor({ config, onChange }: Parameters<FieldTypeModule<MultiSelectField>['configEditor']>[0]) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Options</label>
        {config.options.map((opt, idx) => (
          <div key={opt.id} className="flex gap-2 mb-1">
            <input
              className="border rounded px-2 py-1 flex-1 text-sm"
              value={opt.label}
              onChange={(e) => {
                const options = [...config.options];
                options[idx] = { ...opt, label: e.target.value };
                onChange({ ...config, options });
              }}
              placeholder={`Option ${idx + 1}`}
            />
            <button
              type="button"
              className="text-red-500 px-2 text-sm"
              onClick={() => onChange({ ...config, options: config.options.filter((_, i) => i !== idx) })}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-blue-600 text-sm mt-1"
          onClick={() => onChange({ ...config, options: [...config.options, { id: crypto.randomUUID(), label: '' }] })}
        >
          + Add option
        </button>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Min selections</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.minSelections ?? ''}
            onChange={(e) => onChange(setOpt(config, { minSelections: e.target.value ? parseInt(e.target.value) : undefined }))}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Max selections</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-full text-sm"
            value={config.maxSelections ?? ''}
            onChange={(e) => onChange(setOpt(config, { maxSelections: e.target.value ? parseInt(e.target.value) : undefined }))}
          />
        </div>
      </div>
    </div>
  );
}

function validateMultiSelect(value: unknown, config: MultiSelectField['config'], ctx: { isRequired: boolean }): ValidationError[] {
  const errors: ValidationError[] = [];
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];

  if (ctx.isRequired && selected.length === 0) {
    errors.push({ rule: 'required', message: 'Please select at least one option' });
  }
  if (config.minSelections !== undefined && selected.length > 0 && selected.length < config.minSelections) {
    errors.push({ rule: 'min_selections', message: `Select at least ${config.minSelections} options` });
  }
  if (config.maxSelections !== undefined && selected.length > config.maxSelections) {
    errors.push({ rule: 'max_selections', message: `Select no more than ${config.maxSelections} options` });
  }
  return errors;
}

export const multiSelectFieldModule: FieldTypeModule<MultiSelectField> = {
  type: 'multi_select',
  valueType: 'string[]',
  capturesValue: true,
  canBeCalcSource: false,
  operators: ['multi_contains_any', 'multi_contains_all', 'multi_contains_none'],
  defaultConfig: { options: [] },
  renderer: MultiSelectRenderer,
  configEditor: MultiSelectConfigEditor,
  validator: validateMultiSelect,
  pdfRenderer: (field, value) => {
    const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
    const labels = selected
      .map((id) => field.config.options.find((o) => o.id === id)?.label)
      .filter((l): l is string => l !== undefined);
    return (
      <div className="print-field-row">
        <div className="font-semibold text-sm">{field.label}</div>
        <div className="text-sm">{labels.length > 0 ? labels.join(', ') : '—'}</div>
      </div>
    );
  },
  csvSerializer: (field, value) => {
    const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
    return selected
      .map((id) => field.config.options.find((o) => o.id === id)?.label ?? '')
      .filter(Boolean)
      .join('; ');
  },
};
