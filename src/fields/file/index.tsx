import { useRef } from 'react';
import type { FieldTypeModule } from '@/registry/contract';
import type { FileField, FileMetadata } from '@/types/field';
import type { ValidationError } from '@/types/condition';

function FileRenderer({ field, value, onChange, isRequired, errors, disabled }: Parameters<FieldTypeModule<FileField>['renderer']>[0]) {
  const files: FileMetadata[] = Array.isArray(value) ? (value as FileMetadata[]) : [];
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const metadata: FileMetadata[] = picked.map((f) => ({
      filename: f.name,
      size: f.size,
      type: f.type,
    }));
    const next = [...files, ...metadata].slice(0, field.config.maxFiles);
    onChange(next.length > 0 ? next : undefined);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : undefined);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <div className="border-2 border-dashed rounded p-4 text-center text-sm text-gray-500">
        <input
          ref={inputRef}
          type="file"
          multiple={field.config.maxFiles > 1}
          accept={field.config.allowedTypes.join(',')}
          onChange={handleChange}
          disabled={disabled || files.length >= field.config.maxFiles}
          className="sr-only"
          id={`file-input-${field.id}`}
          aria-required={isRequired}
          aria-invalid={errors.length > 0}
        />
        <label htmlFor={`file-input-${field.id}`} className="cursor-pointer text-blue-600 hover:underline">
          Click to upload
        </label>
        {field.config.allowedTypes.length > 0 && (
          <span className="ml-1 text-gray-400">({field.config.allowedTypes.join(', ')})</span>
        )}
      </div>
      {files.length > 0 && (
        <ul className="text-sm space-y-1">
          {files.map((f, idx) => (
            <li key={idx} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
              <span>{f.filename} ({Math.round(f.size / 1024)} KB)</span>
              {!disabled && (
                <button type="button" onClick={() => remove(idx)} className="text-red-500 text-xs">Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {errors.map((e) => (
        <p key={e.rule} className="text-red-600 text-xs">{e.message}</p>
      ))}
    </div>
  );
}

function FileConfigEditor({ config, onChange }: Parameters<FieldTypeModule<FileField>['configEditor']>[0]) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Max files</label>
        <input
          type="number"
          className="border rounded px-2 py-1 w-full text-sm"
          min={1}
          value={config.maxFiles}
          onChange={(e) => onChange({ ...config, maxFiles: parseInt(e.target.value) || 1 })}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Allowed types (comma-separated)</label>
        <input
          className="border rounded px-2 py-1 w-full text-sm"
          value={config.allowedTypes.join(', ')}
          placeholder=".pdf, .jpg, .png"
          onChange={(e) => onChange({ ...config, allowedTypes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        />
      </div>
    </div>
  );
}

function validateFile(value: unknown, config: FileField['config'], ctx: { isRequired: boolean }): ValidationError[] {
  const errors: ValidationError[] = [];
  const files: FileMetadata[] = Array.isArray(value) ? (value as FileMetadata[]) : [];

  if (ctx.isRequired && files.length === 0) {
    errors.push({ rule: 'required', message: 'Please upload at least one file' });
  }
  if (files.length > config.maxFiles) {
    errors.push({ rule: 'max_files', message: `Maximum ${config.maxFiles} file(s) allowed` });
  }
  if (config.allowedTypes.length > 0) {
    const invalid = files.filter((f) => !config.allowedTypes.some((t) => f.filename.toLowerCase().endsWith(t)));
    if (invalid.length > 0) {
      errors.push({ rule: 'allowed_types', message: `Allowed types: ${config.allowedTypes.join(', ')}` });
    }
  }
  return errors;
}

export const fileFieldModule: FieldTypeModule<FileField> = {
  type: 'file',
  valueType: 'file[]',
  capturesValue: true,
  canBeCalcSource: false,
  operators: [],
  defaultConfig: { allowedTypes: [], maxFiles: 1 },
  renderer: FileRenderer,
  configEditor: FileConfigEditor,
  validator: validateFile,
  pdfRenderer: (field, value) => {
    const files: FileMetadata[] = Array.isArray(value) ? (value as FileMetadata[]) : [];
    return (
      <div className="print-field-row">
        <div className="font-semibold text-sm">{field.label}</div>
        <div className="text-sm">
          {files.length > 0 ? files.map((f) => f.filename).join(', ') : '—'}
        </div>
      </div>
    );
  },
  csvSerializer: (_field, value) => {
    const files: FileMetadata[] = Array.isArray(value) ? (value as FileMetadata[]) : [];
    return files.map((f) => f.filename).join('; ');
  },
};
