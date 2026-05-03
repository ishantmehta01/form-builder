import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { numberFieldModule } from './index';
import type { NumberField } from '@/types/field';

const baseField: NumberField = {
  id: 'f1',
  type: 'number',
  label: 'Amount',
  conditions: [],
  conditionLogic: 'OR',
  defaultVisible: true,
  defaultRequired: false,
  config: { decimalPlaces: 0 },
};

const { validator, renderer: Renderer, configEditor: ConfigEditor } = numberFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('number validator', () => {
  it('required + no value → required error', () => {
    expect(validator(undefined, { decimalPlaces: 0 }, { isRequired: true }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'required' })]));
  });

  it('optional + no value → no error', () => {
    expect(validator(undefined, { decimalPlaces: 0 }, { isRequired: false })).toHaveLength(0);
  });

  it.each([
    [5, 10, true],    // below min
    [10, 10, false],  // exact min — OK
    [15, 10, false],  // above min — OK
  ])('min boundary: value=%d min=%d → error=%s', (val, min, shouldError) => {
    const errors = validator(val, { decimalPlaces: 0, min }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'min')).toBe(shouldError);
  });

  it.each([
    [100, 99, true],   // above max
    [99, 99, false],   // exact max — OK
    [50, 99, false],   // below max — OK
  ])('max boundary: value=%d max=%d → error=%s', (val, max, shouldError) => {
    const errors = validator(val, { decimalPlaces: 0, max }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'max')).toBe(shouldError);
  });

  it('99.9 with max=99 → max error (raw value compared, no rounding)', () => {
    const errors = validator(99.9, { decimalPlaces: 0, max: 99 }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'max')).toBe(true);
  });

  it('non-numeric value with required → required error', () => {
    const errors = validator('abc', { decimalPlaces: 0 }, { isRequired: true });
    expect(errors.some((e) => e.rule === 'required')).toBe(true);
  });
});

// ── G3: Renderer ───────────────────────────────────────────────────────────

describe('number renderer', () => {
  it('renders without error', () => {
    render(<Renderer field={baseField} value={42} onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('shows required asterisk', () => {
    render(<Renderer field={baseField} value={0} onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('has aria-required', () => {
    render(<Renderer field={baseField} value={0} onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-required', 'true');
  });

  it('fires onChange with parsed number', () => {
    const onChange = vi.fn();
    render(<Renderer field={baseField} value={0} onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('fires onChange with undefined when cleared', () => {
    const onChange = vi.fn();
    render(<Renderer field={baseField} value={5} onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('no aria-describedby when errors is empty', () => {
    render(<Renderer field={baseField} value={0} onChange={vi.fn()} isRequired={false} errors={[]} />);
    expect(screen.getByRole('spinbutton')).not.toHaveAttribute('aria-describedby');
  });

  it('aria-describedby links to error container when errors present', () => {
    const { container } = render(
      <Renderer field={baseField} value={undefined} onChange={vi.fn()} isRequired={false}
        errors={[{ rule: 'required', message: 'Required' }]}
      />
    );
    const errorId = 'field-f1-error';
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-describedby', errorId);
    expect(container.querySelector(`#${errorId}`)).toHaveAttribute('role', 'alert');
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('number configEditor', () => {
  it('renders decimal-places selector', () => {
    render(<ConfigEditor config={{ decimalPlaces: 0 }} onChange={vi.fn()} allFields={[]} ownerFieldId="f1" />);
    // Decimal places is the only combobox in this config editor
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Decimal places')).toBeInTheDocument();
  });

  it('fires onChange when decimal places changed', () => {
    const onChange = vi.fn();
    render(<ConfigEditor config={{ decimalPlaces: 0 }} onChange={onChange} allFields={[]} ownerFieldId="f1" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ decimalPlaces: 2 }));
  });
});
