import type { FieldTypeModule } from '@/registry/contract';
import type { SingleSelectField } from '@/types/field';
import type { ValidationError } from '@/types/condition';

function SingleSelectRenderer({ field, value, onChange, isRequired, errors, disabled }: Parameters<FieldTypeModule<SingleSelectField>['renderer']>[0]) {
  const selected = typeof value === 'string' ? value : '';
  const { options, displayType } = field.config;

  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>

      {displayType === 'dropdown' ? (
        <select
          className="border rounded px-3 py-2 w-full"
          value={selected}
          onChange={(e) => onChange(e.target.value || undefined)}
          disabled={disabled}
          aria-required={isRequired}
          aria-invalid={errors.length > 0}
        >
          <option value="">— Select —</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      ) : displayType === 'tiles' ? (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected === opt.id ? undefined : opt.id)}
              className={`px-4 py-2 border rounded text-sm transition-colors ${selected === opt.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
              aria-pressed={selected === opt.id}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        // radio
        <div className="flex flex-col gap-1">
          {options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={opt.id}
                checked={selected === opt.id}
                onChange={() => onChange(opt.id)}
                disabled={disabled}
                aria-required={isRequired}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {errors.map((e) => (
        <p key={e.rule} className="text-red-600 text-xs">{e.message}</p>
      ))}
    </div>
  );
}

function SingleSelectConfigEditor({ config, onChange }: Parameters<FieldTypeModule<SingleSelectField>['configEditor']>[0]) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Display type</label>
        <select
          className="border rounded px-2 py-1 w-full text-sm"
          value={config.displayType}
          onChange={(e) => onChange({ ...config, displayType: e.target.value as 'radio' | 'dropdown' | 'tiles' })}
        >
          <option value="radio">Radio buttons</option>
          <option value="dropdown">Dropdown</option>
          <option value="tiles">Tiles</option>
        </select>
      </div>
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
              onClick={() => {
                const options = config.options.filter((_, i) => i !== idx);
                onChange({ ...config, options });
              }}
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
    </div>
  );
}

function validateSingleSelect(value: unknown, _config: SingleSelectField['config'], ctx: { isRequired: boolean }): ValidationError[] {
  const errors: ValidationError[] = [];
  const selected = typeof value === 'string' ? value : '';

  if (ctx.isRequired && !selected) {
    errors.push({ rule: 'required', message: 'Please select an option' });
  }
  return errors;
}

export const singleSelectFieldModule: FieldTypeModule<SingleSelectField> = {
  type: 'single_select',
  valueType: 'string',
  capturesValue: true,
  canBeCalcSource: false,
  operators: ['select_equals', 'select_not_equals'],
  defaultConfig: { options: [], displayType: 'radio' },
  renderer: SingleSelectRenderer,
  configEditor: SingleSelectConfigEditor,
  validator: validateSingleSelect,
  pdfRenderer: (field, value) => {
    const opt = field.config.options.find((o) => o.id === value);
    return (
      <div className="print-field-row">
        <div className="font-semibold text-sm">{field.label}</div>
        <div className="text-sm">{opt ? opt.label : '—'}</div>
      </div>
    );
  },
  csvSerializer: (field, value) => {
    const opt = field.config.options.find((o) => o.id === value);
    return opt ? opt.label : '';
  },
};
