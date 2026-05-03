import type { FieldTypeModule } from '@/registry/contract';
import type { CalculationField } from '@/types/field';

function CalculationRenderer({ field, value }: Parameters<FieldTypeModule<CalculationField>['renderer']>[0]) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const display = num !== null ? num.toFixed(field.config.decimalPlaces) : '—';

  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-sm text-gray-700">{field.label}</span>
      <div className="border rounded px-3 py-2 bg-gray-50 text-gray-800 font-mono w-full">
        {display}
      </div>
    </div>
  );
}

function CalculationConfigEditor({ config, onChange, allFields }: Parameters<FieldTypeModule<CalculationField>['configEditor']>[0]) {
  const numberFields = allFields.filter((f) => f.type === 'number');

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Aggregation</label>
        <select
          className="border rounded px-2 py-1 w-full text-sm"
          value={config.aggregation}
          onChange={(e) => onChange({ ...config, aggregation: e.target.value as CalculationField['config']['aggregation'] })}
        >
          <option value="sum">Sum</option>
          <option value="average">Average</option>
          <option value="min">Minimum</option>
          <option value="max">Maximum</option>
        </select>
      </div>
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
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Source fields</label>
        {numberFields.length === 0 ? (
          <p className="text-xs text-gray-400">No number fields available</p>
        ) : (
          numberFields.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm mb-1">
              <input
                type="checkbox"
                checked={config.sourceFieldIds.includes(f.id)}
                onChange={(e) => {
                  const ids = e.target.checked
                    ? [...config.sourceFieldIds, f.id]
                    : config.sourceFieldIds.filter((id) => id !== f.id);
                  onChange({ ...config, sourceFieldIds: ids });
                }}
              />
              {f.label}
            </label>
          ))
        )}
        {config.sourceFieldIds.length === 1 && (
          <p className="text-xs text-amber-600 mt-1">
            ⚠ Single-source calc: {config.aggregation} of one number = that number. Consider hiding the calc with the same condition as the source.
          </p>
        )}
      </div>
    </div>
  );
}

export const calculationFieldModule: FieldTypeModule<CalculationField> = {
  type: 'calculation',
  valueType: 'number',
  capturesValue: true,
  canBeCalcSource: false,
  operators: ['number_equals', 'number_gt', 'number_lt', 'number_within_range'],
  defaultConfig: { sourceFieldIds: [], aggregation: 'sum', decimalPlaces: 0 },
  renderer: CalculationRenderer,
  configEditor: CalculationConfigEditor,
  validator: () => [],
  pdfRenderer: (field, value) => {
    const num = typeof value === 'number' && Number.isFinite(value) ? value : null;
    return (
      <div className="print-field-row">
        <div className="font-semibold text-sm">{field.label}</div>
        <div className="text-sm font-mono">{num !== null ? num.toFixed(field.config.decimalPlaces) : '—'}</div>
      </div>
    );
  },
  csvSerializer: (field, value) =>
    typeof value === 'number' && Number.isFinite(value)
      ? value.toFixed(field.config.decimalPlaces)
      : '',
};
