import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportCSV } from './csv';
import type { Instance, Template } from '@/types/template';
import type { Field } from '@/types/field';

let capturedCSV = '';

function makeTemplate(id: string, fields: Field[]): Template {
  return { id, title: 'T', fields, createdAt: '2026-01-01T00:00:00Z', modifiedAt: '2026-01-01T00:00:00Z' };
}

function makeInstance(id: string, snapshot: Template, values: Record<string, unknown>, visibility: Record<string, boolean>): Instance {
  return { id, templateId: snapshot.id, templateSnapshot: snapshot, values, visibility, submittedAt: '2026-01-01T00:00:00Z' };
}

const textField: Field = { id: 'name', type: 'text', label: 'Name', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: {} };
const numField: Field = { id: 'age', type: 'number', label: 'Age', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 0 } };
const dateField: Field = { id: 'dob', type: 'date', label: 'DOB', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: { prefillToday: false } };
const singleSelectField: Field = {
  id: 'color', type: 'single_select', label: 'Color', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false,
  config: { options: [{ id: 'r', label: 'Red' }, { id: 'b', label: 'Blue' }], displayType: 'radio' },
};
const multiSelectField: Field = {
  id: 'tags', type: 'multi_select', label: 'Tags', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false,
  config: { options: [{ id: 't1', label: 'Apple' }, { id: 't2', label: 'Banana' }] },
};
const fileField: Field = { id: 'doc', type: 'file', label: 'Doc', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: { allowedTypes: [], maxFiles: 3 } };
const sectionField: Field = { id: 'sec', type: 'section_header', label: 'Section', conditions: [], conditionLogic: 'OR', defaultVisible: true, config: { size: 'md' } };
const calcField: Field = { id: 'total', type: 'calculation', label: 'Total', conditions: [], conditionLogic: 'OR', defaultVisible: true, config: { sourceFieldIds: ['age'], aggregation: 'sum', decimalPlaces: 2 } };

beforeEach(() => {
  capturedCSV = '';
  vi.stubGlobal('Blob', class FakeBlob {
    constructor(parts: BlobPart[]) {
      capturedCSV = (parts as string[]).join('');
    }
  });
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as unknown as ChildNode);
  vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as unknown as ChildNode);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CSV export — basic structure', () => {
  it('empty instances list → no crash, no Blob created', () => {
    exportCSV([], 'test.csv');
    expect(capturedCSV).toBe('');
  });

  it('section_header has no column (capturesValue=false)', () => {
    const snap = makeTemplate('t1', [textField, sectionField]);
    const inst = makeInstance('i1', snap, { name: 'Alice' }, { name: true, sec: true });
    exportCSV([inst], 'test.csv');
    const [header] = capturedCSV.split('\r\n');
    expect(header).toContain('Name');
    expect(header).not.toContain('Section');
  });
});

describe('CSV export — RFC 4180 escaping', () => {
  it('value with comma → wrapped in double quotes', () => {
    const snap = makeTemplate('t1', [textField]);
    const inst = makeInstance('i1', snap, { name: 'Smith, John' }, { name: true });
    exportCSV([inst], 'test.csv');
    expect(capturedCSV).toContain('"Smith, John"');
  });

  it('value with embedded quote → quote escaped as ""', () => {
    const snap = makeTemplate('t1', [textField]);
    const inst = makeInstance('i1', snap, { name: 'He said "hi"' }, { name: true });
    exportCSV([inst], 'test.csv');
    expect(capturedCSV).toContain('"He said ""hi"""');
  });

  it('value with newline → wrapped in double quotes', () => {
    const snap = makeTemplate('t1', [textField]);
    const inst = makeInstance('i1', snap, { name: 'line1\nline2' }, { name: true });
    exportCSV([inst], 'test.csv');
    expect(capturedCSV).toContain('"line1\nline2"');
  });
});

describe('CSV export — per-type serialization', () => {
  it('number → string with configured decimal places', () => {
    const snap = makeTemplate('t1', [numField]);
    const inst = makeInstance('i1', snap, { age: 25 }, { age: true });
    exportCSV([inst], 'test.csv');
    const rows = capturedCSV.split('\r\n');
    expect(rows[1]).toBe('25');
  });

  it('date → YYYY-MM-DD string', () => {
    const snap = makeTemplate('t1', [dateField]);
    const inst = makeInstance('i1', snap, { dob: '1990-06-15' }, { dob: true });
    exportCSV([inst], 'test.csv');
    const rows = capturedCSV.split('\r\n');
    expect(rows[1]).toBe('1990-06-15');
  });

  it('single_select → option label not ID', () => {
    const snap = makeTemplate('t1', [singleSelectField]);
    const inst = makeInstance('i1', snap, { color: 'r' }, { color: true });
    exportCSV([inst], 'test.csv');
    const rows = capturedCSV.split('\r\n');
    expect(rows[1]).toBe('Red');
  });

  it('multi_select → labels joined with separator', () => {
    const snap = makeTemplate('t1', [multiSelectField]);
    const inst = makeInstance('i1', snap, { tags: ['t1', 't2'] }, { tags: true });
    exportCSV([inst], 'test.csv');
    const rows = capturedCSV.split('\r\n');
    expect(rows[1]).toContain('Apple');
    expect(rows[1]).toContain('Banana');
  });

  it('file → pipe-separated filenames', () => {
    const snap = makeTemplate('t1', [fileField]);
    const files = [{ filename: 'a.pdf', size: 100, type: 'application/pdf' }, { filename: 'b.pdf', size: 200, type: 'application/pdf' }];
    const inst = makeInstance('i1', snap, { doc: files }, { doc: true });
    exportCSV([inst], 'test.csv');
    const rows = capturedCSV.split('\r\n');
    expect(rows[1]).toContain('a.pdf');
    expect(rows[1]).toContain('b.pdf');
  });

  it('calculation → numeric string with decimal places', () => {
    const snap = makeTemplate('t1', [calcField]);
    const inst = makeInstance('i1', snap, { total: 99.5 }, { total: true });
    exportCSV([inst], 'test.csv');
    const rows = capturedCSV.split('\r\n');
    expect(rows[1]).toBe('99.50');
  });
});

describe('CSV export — visibility and empty cells', () => {
  it('hidden field → empty cell', () => {
    const snap = makeTemplate('t1', [textField, numField]);
    const inst = makeInstance('i1', snap, { name: 'Alice', age: 30 }, { name: true, age: false });
    exportCSV([inst], 'test.csv');
    const rows = capturedCSV.split('\r\n');
    expect(rows[1]).toBe('Alice,');
  });

  it('visible-but-empty field → empty cell', () => {
    const snap = makeTemplate('t1', [textField, numField]);
    const inst = makeInstance('i1', snap, { name: 'Alice' }, { name: true, age: true });
    exportCSV([inst], 'test.csv');
    const rows = capturedCSV.split('\r\n');
    expect(rows[1]).toBe('Alice,');
  });
});

describe('CSV export — union of snapshots', () => {
  it('field from older snapshot appears as column for that instance', () => {
    // snap2 has extra field "notes" that snap1 (newer) lacks
    const snap1 = makeTemplate('t1', [textField]);
    const notesField: Field = { id: 'notes', type: 'text', label: 'Notes', conditions: [], conditionLogic: 'OR', defaultVisible: true, defaultRequired: false, config: {} };
    const snap2 = makeTemplate('t1', [textField, notesField]);

    const inst1 = makeInstance('i1', snap1, { name: 'Alice' }, { name: true });
    const inst2 = makeInstance('i2', snap2, { name: 'Bob', notes: 'hi' }, { name: true, notes: true });

    exportCSV([inst1, inst2], 'test.csv');
    const [header] = capturedCSV.split('\r\n');
    expect(header).toContain('Name');
    expect(header).toContain('Notes');
  });

  it('first-instance label is used for shared field', () => {
    // Both instances share field id 'name' but with different labels in their snapshots
    const snap1Fields: Field[] = [{ ...textField, label: 'Full Name' }];
    const snap2Fields: Field[] = [{ ...textField, label: 'Name' }];
    const snap1 = makeTemplate('t1', snap1Fields);
    const snap2 = makeTemplate('t1', snap2Fields);

    const inst1 = makeInstance('i1', snap1, { name: 'Alice' }, { name: true });
    const inst2 = makeInstance('i2', snap2, { name: 'Bob' }, { name: true });

    exportCSV([inst1, inst2], 'test.csv');
    const [header] = capturedCSV.split('\r\n');
    // First instance label wins (code inserts first occurrence only)
    expect(header).toContain('Full Name');
  });
});
