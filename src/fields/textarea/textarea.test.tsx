import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { textareaFieldModule } from './index';
import type { TextareaField } from '@/types/field';

const baseField: TextareaField = {
  id: 'f1',
  type: 'textarea',
  label: 'Notes',
  conditions: [],
  conditionLogic: 'OR',
  defaultVisible: true,
  defaultRequired: false,
  config: {},
};

const { validator, renderer: Renderer, configEditor: ConfigEditor } = textareaFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('textarea validator', () => {
  it('required + empty → required error', () => {
    const errors = validator('', {}, { isRequired: true });
    expect(errors.some((e) => e.rule === 'required')).toBe(true);
  });

  it('optional + empty → no error', () => {
    expect(validator('', {}, { isRequired: false })).toHaveLength(0);
  });

  it.each([
    ['hi', 5, true],
    ['hello', 5, false],
    ['hello world', 5, false],
  ])('minLength: "%s" (min=%d) → error=%s', (val, min, shouldError) => {
    const errors = validator(val, { minLength: min }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'min_length')).toBe(shouldError);
  });

  it.each([
    ['hi', 3, false],
    ['hey', 3, false],
    ['hell', 3, true],
  ])('maxLength: "%s" (max=%d) → error=%s', (val, max, shouldError) => {
    const errors = validator(val, { maxLength: max }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'max_length')).toBe(shouldError);
  });

  it('empty optional with minLength → no error', () => {
    expect(validator('', { minLength: 10 }, { isRequired: false })).toHaveLength(0);
  });
});

// ── G3: Renderer ───────────────────────────────────────────────────────────

describe('textarea renderer', () => {
  it('renders without error', () => {
    render(<Renderer field={baseField} value="hello" onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows required asterisk when isRequired=true', () => {
    render(<Renderer field={baseField} value="" onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('has aria-required when isRequired=true', () => {
    render(<Renderer field={baseField} value="" onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('fires onChange', () => {
    const onChange = vi.fn();
    render(<Renderer field={baseField} value="" onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'notes' } });
    expect(onChange).toHaveBeenCalledWith('notes');
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('textarea configEditor', () => {
  it('renders with default config', () => {
    const { container } = render(<ConfigEditor config={{ rows: 4 }} onChange={vi.fn()} allFields={[]} ownerFieldId="f1" />);
    expect(screen.getByText('Placeholder')).toBeInTheDocument();
    expect(container.querySelectorAll('input').length).toBeGreaterThan(0);
  });

  it('fires onChange when rows updated', () => {
    const onChange = vi.fn();
    render(<ConfigEditor config={{ rows: 4 }} onChange={onChange} allFields={[]} ownerFieldId="f1" />);
    // First spinbutton is the rows input
    fireEvent.change(screen.getAllByRole('spinbutton')[0]!, { target: { value: '6' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rows: 6 }));
  });
});
