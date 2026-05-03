import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { textFieldModule } from './index';
import type { TextField } from '@/types/field';

const baseField: TextField = {
  id: 'f1',
  type: 'text',
  label: 'Name',
  conditions: [],
  conditionLogic: 'OR',
  defaultVisible: true,
  defaultRequired: false,
  config: {},
};

const { validator, renderer: Renderer, configEditor: ConfigEditor } = textFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('text validator', () => {
  it('required + empty → required error', () => {
    const errors = validator('', {}, { isRequired: true });
    expect(errors.some((e) => e.rule === 'required')).toBe(true);
  });

  it('required + whitespace-only → required error', () => {
    const errors = validator('   ', {}, { isRequired: true });
    expect(errors.some((e) => e.rule === 'required')).toBe(true);
  });

  it('optional + empty → no error', () => {
    expect(validator('', {}, { isRequired: false })).toHaveLength(0);
    expect(validator(undefined, {}, { isRequired: false })).toHaveLength(0);
  });

  it.each([
    ['hi', 3, true],    // under min
    ['hey', 3, false],  // exact min — OK
    ['hello', 3, false], // over min — OK
  ])('minLength: "%s" (min=%d) → error=%s', (val, min, shouldError) => {
    const errors = validator(val, { minLength: min }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'min_length')).toBe(shouldError);
  });

  it.each([
    ['hi', 3, false],    // under max — OK
    ['hey', 3, false],   // exact max — OK
    ['hell', 3, true],   // over max
  ])('maxLength: "%s" (max=%d) → error=%s', (val, max, shouldError) => {
    const errors = validator(val, { maxLength: max }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'max_length')).toBe(shouldError);
  });

  it('empty string with minLength set → no error (empty is allowed for optional)', () => {
    const errors = validator('', { minLength: 5 }, { isRequired: false });
    expect(errors).toHaveLength(0);
  });
});

// ── G3: Renderer ───────────────────────────────────────────────────────────

describe('text renderer', () => {
  it('renders without error with valid config', () => {
    render(<Renderer field={baseField} value="hello" onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows required asterisk when isRequired=true', () => {
    render(<Renderer field={baseField} value="" onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('input has aria-required when isRequired=true', () => {
    render(<Renderer field={baseField} value="" onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('fires onChange with the typed value', () => {
    const onChange = vi.fn();
    render(<Renderer field={baseField} value="" onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('fires onChange with undefined when input cleared', () => {
    const onChange = vi.fn();
    render(<Renderer field={baseField} value="x" onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('renders error messages', () => {
    render(
      <Renderer field={baseField} value="" onChange={vi.fn()} isRequired={false}
        errors={[{ rule: 'required', message: 'This field is required' }]}
      />
    );
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('no aria-describedby when errors is empty', () => {
    render(<Renderer field={baseField} value="" onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });

  it('aria-describedby links to error container when errors present', () => {
    const { container } = render(
      <Renderer field={baseField} value="" onChange={vi.fn()} isRequired={false}
        errors={[{ rule: 'required', message: 'Required' }]}
      />
    );
    const errorId = 'field-f1-error';
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', errorId);
    expect(container.querySelector(`#${errorId}`)).toHaveAttribute('role', 'alert');
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('text configEditor', () => {
  it('renders without error with default config', () => {
    const { container } = render(<ConfigEditor config={{}} onChange={vi.fn()} allFields={[]} ownerFieldId="f1" />);
    // Placeholder label is visible text in the DOM
    expect(screen.getByText('Placeholder')).toBeInTheDocument();
    expect(container.querySelectorAll('input').length).toBeGreaterThan(0);
  });

  it('fires onChange when min-length input updated', () => {
    const onChange = vi.fn();
    render(<ConfigEditor config={{}} onChange={onChange} allFields={[]} ownerFieldId="f1" />);
    // First spinbutton is the min-length input
    fireEvent.change(screen.getAllByRole('spinbutton')[0]!, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minLength: 5 }));
  });
});
