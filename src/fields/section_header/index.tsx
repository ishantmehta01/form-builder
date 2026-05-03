import type { FieldTypeModule } from '@/registry/contract';
import type { SectionHeaderField } from '@/types/field';

const sizeMap: Record<SectionHeaderField['config']['size'], string> = {
  xs: 'text-sm font-semibold text-gray-700',
  sm: 'text-base font-semibold text-gray-800',
  md: 'text-lg font-bold text-gray-900',
  lg: 'text-xl font-bold text-gray-900',
  xl: 'text-2xl font-bold text-gray-900',
};

function SectionHeaderRenderer({ field }: Parameters<FieldTypeModule<SectionHeaderField>['renderer']>[0]) {
  const cls = sizeMap[field.config.size];
  return (
    <div className="mt-4 mb-2 border-b pb-1">
      <span className={cls}>{field.label}</span>
    </div>
  );
}

function SectionHeaderConfigEditor({ config, onChange }: Parameters<FieldTypeModule<SectionHeaderField>['configEditor']>[0]) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Size</label>
      <select
        className="border rounded px-2 py-1 w-full text-sm"
        value={config.size}
        onChange={(e) => onChange({ ...config, size: e.target.value as SectionHeaderField['config']['size'] })}
      >
        {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s) => (
          <option key={s} value={s}>{s.toUpperCase()}</option>
        ))}
      </select>
    </div>
  );
}

export const sectionHeaderFieldModule: FieldTypeModule<SectionHeaderField> = {
  type: 'section_header',
  valueType: 'none',
  capturesValue: false,
  canBeCalcSource: false,
  operators: [],
  defaultConfig: { size: 'md' },
  renderer: SectionHeaderRenderer,
  configEditor: SectionHeaderConfigEditor,
  validator: () => [],
  pdfRenderer: (field) => (
    <div className="print-section-header border-b pb-1 mt-4 mb-2">
      <span className={`font-bold ${field.config.size === 'xl' || field.config.size === 'lg' ? 'text-lg' : 'text-base'}`}>
        {field.label}
      </span>
    </div>
  ),
  csvSerializer: () => '',
};
