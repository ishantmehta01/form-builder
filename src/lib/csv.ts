import type { Instance } from '@/types/template';
import type { Field } from '@/types/field';
import { registry } from '@/registry';

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCSV(instances: Instance[], filename: string): void {
  if (instances.length === 0) return;

  // Union of all fields across all instance snapshots, deduped by ID, ordered by latest-snapshot position
  const fieldMap = new Map<string, Field>();
  for (const inst of instances) {
    for (const field of inst.templateSnapshot.fields) {
      if (!fieldMap.has(field.id)) {
        fieldMap.set(field.id, field);
      }
    }
  }

  // Only capturesValue fields are serialized
  const columns = [...fieldMap.values()].filter((f) => registry[f.type].capturesValue);

  const header = columns.map((f) => escapeCSV(f.label)).join(',');

  const rows = instances.map((inst) => {
    return columns.map((field) => {
      if (inst.visibility[field.id] === false) return '';
      const value = inst.values[field.id];
      if (value === undefined) return '';
      const serializer = registry[field.type].csvSerializer;
      return escapeCSV(serializer(field as never, value));
    }).join(',');
  });

  const csv = [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
