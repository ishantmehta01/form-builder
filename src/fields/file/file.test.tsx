import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { fileFieldModule } from './index';
import type { FileField, FileMetadata } from '@/types/field';

const baseField: FileField = {
  id: 'f1',
  type: 'file',
  label: 'Attachment',
  conditions: [],
  conditionLogic: 'OR',
  defaultVisible: true,
  defaultRequired: false,
  config: { allowedTypes: [], maxFiles: 1 },
};

const mockFile: FileMetadata = { filename: 'report.pdf', size: 1024, type: 'application/pdf' };

const { validator, renderer: Renderer, configEditor: ConfigEditor } = fileFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('file validator', () => {
  it('required + no files → required error', () => {
    const errors = validator([], { allowedTypes: [], maxFiles: 1 }, { isRequired: true });
    expect(errors.some((e) => e.rule === 'required')).toBe(true);
  });

  it('optional + no files → no error', () => {
    expect(validator([], { allowedTypes: [], maxFiles: 1 }, { isRequired: false })).toHaveLength(0);
  });

  it('exceeding maxFiles → max_files error', () => {
    const files = [mockFile, { ...mockFile, filename: 'a.pdf' }];
    const errors = validator(files, { allowedTypes: [], maxFiles: 1 }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'max_files')).toBe(true);
  });

  it('exact maxFiles → no error', () => {
    const errors = validator([mockFile], { allowedTypes: [], maxFiles: 1 }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'max_files')).toBe(false);
  });

  it('allowed type: matching extension → no error', () => {
    const errors = validator(
      [mockFile],
      { allowedTypes: ['.pdf'], maxFiles: 5 },
      { isRequired: false },
    );
    expect(errors.some((e) => e.rule === 'allowed_types')).toBe(false);
  });

  it('allowed type: wrong extension → allowed_types error', () => {
    const errors = validator(
      [{ filename: 'image.jpg', size: 100, type: 'image/jpeg' }],
      { allowedTypes: ['.pdf'], maxFiles: 5 },
      { isRequired: false },
    );
    expect(errors.some((e) => e.rule === 'allowed_types')).toBe(true);
  });

  it('allowed type check is case-insensitive', () => {
    const errors = validator(
      [{ filename: 'REPORT.PDF', size: 100, type: 'application/pdf' }],
      { allowedTypes: ['.pdf'], maxFiles: 5 },
      { isRequired: false },
    );
    expect(errors.some((e) => e.rule === 'allowed_types')).toBe(false);
  });
});

// ── G3: Renderer ───────────────────────────────────────────────────────────

describe('file renderer', () => {
  it('renders upload zone without error', () => {
    render(<Renderer field={baseField} value={[]} onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByText(/click to upload/i)).toBeInTheDocument();
  });

  it('shows required asterisk', () => {
    render(<Renderer field={baseField} value={[]} onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders existing file metadata (no actual upload)', () => {
    render(<Renderer field={baseField} value={[mockFile]} onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByText(/report.pdf/)).toBeInTheDocument();
  });

  it('no aria-describedby on file input when errors empty', () => {
    const { container } = render(<Renderer field={baseField} value={[]} onChange={vi.fn()} isRequired={false} errors={[]} />);
    const input = container.querySelector('input[type="file"]')!;
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('aria-describedby on file input links to error container when errors present', () => {
    const { container } = render(
      <Renderer field={baseField} value={[]} onChange={vi.fn()} isRequired={false}
        errors={[{ rule: 'required', message: 'Required' }]}
      />
    );
    const errorId = 'field-f1-error';
    const input = container.querySelector('input[type="file"]')!;
    expect(input).toHaveAttribute('aria-describedby', errorId);
    expect(container.querySelector(`#${errorId}`)).toHaveAttribute('role', 'alert');
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('file configEditor', () => {
  it('renders without error', () => {
    render(<ConfigEditor config={{ allowedTypes: [], maxFiles: 1 }} onChange={vi.fn()} allFields={[]} ownerFieldId="f1" />);
    expect(screen.getByText('Max files')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('fires onChange when max files changed', () => {
    const onChange = vi.fn();
    render(<ConfigEditor config={{ allowedTypes: [], maxFiles: 1 }} onChange={onChange} allFields={[]} ownerFieldId="f1" />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxFiles: 3 }));
  });
});
