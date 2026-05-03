import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { dateFieldModule } from './index';
import type { DateField } from '@/types/field';

const baseField: DateField = {
  id: 'f1',
  type: 'date',
  label: 'Birthday',
  conditions: [],
  conditionLogic: 'OR',
  defaultVisible: true,
  defaultRequired: false,
  config: { prefillToday: false },
};

const { validator, renderer: Renderer, configEditor: ConfigEditor } = dateFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('date validator', () => {
  it('required + empty → required error', () => {
    expect(validator('', { prefillToday: false }, { isRequired: true }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'required' })]));
  });

  it('optional + empty → no error', () => {
    expect(validator('', { prefillToday: false }, { isRequired: false })).toHaveLength(0);
  });

  it('invalid date format → invalid_format error', () => {
    const errors = validator('not-a-date', { prefillToday: false }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'invalid_format')).toBe(true);
  });

  it.each([
    ['2024-01-01', '2024-06-01', true],   // before min
    ['2024-06-01', '2024-06-01', false],  // exact min — OK
    ['2024-12-31', '2024-06-01', false],  // after min — OK
  ])('minDate: value=%s min=%s → error=%s', (val, min, shouldError) => {
    const errors = validator(val, { prefillToday: false, minDate: min }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'min_date')).toBe(shouldError);
  });

  it.each([
    ['2024-12-31', '2024-06-01', true],  // after max
    ['2024-06-01', '2024-06-01', false], // exact max — OK
    ['2024-01-01', '2024-06-01', false], // before max — OK
  ])('maxDate: value=%s max=%s → error=%s', (val, max, shouldError) => {
    const errors = validator(val, { prefillToday: false, maxDate: max }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'max_date')).toBe(shouldError);
  });
});

// ── G3: Renderer ───────────────────────────────────────────────────────────

describe('date renderer', () => {
  it('renders a date input', () => {
    render(<Renderer field={baseField} value="2024-06-01" onChange={vi.fn()} isRequired={false} errors={[]} />);
    const input = screen.getByDisplayValue('2024-06-01');
    expect(input).toBeInTheDocument();
  });

  it('shows required asterisk', () => {
    render(<Renderer field={baseField} value="" onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('fires onChange with date string', () => {
    const onChange = vi.fn();
    render(<Renderer field={baseField} value="" onChange={onChange} isRequired={false} errors={[]} />);
    const input = document.querySelector('input[type="date"]')!;
    fireEvent.change(input, { target: { value: '2024-03-15' } });
    expect(onChange).toHaveBeenCalledWith('2024-03-15');
  });

  it('no aria-describedby when errors is empty', () => {
    const { container } = render(<Renderer field={baseField} value="" onChange={vi.fn()} isRequired={false} errors={[]} />);
    const input = container.querySelector('input[type="date"]')!;
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('aria-describedby links to error container when errors present', () => {
    const { container } = render(
      <Renderer field={baseField} value="" onChange={vi.fn()} isRequired={false}
        errors={[{ rule: 'required', message: 'Required' }]}
      />
    );
    const errorId = 'field-f1-error';
    const input = container.querySelector('input[type="date"]')!;
    expect(input).toHaveAttribute('aria-describedby', errorId);
    expect(container.querySelector(`#${errorId}`)).toHaveAttribute('role', 'alert');
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('date configEditor', () => {
  it('renders prefillToday checkbox', () => {
    render(<ConfigEditor config={{ prefillToday: false }} onChange={vi.fn()} allFields={[]} ownerFieldId="f1" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('fires onChange when prefillToday toggled', () => {
    const onChange = vi.fn();
    render(<ConfigEditor config={{ prefillToday: false }} onChange={onChange} allFields={[]} ownerFieldId="f1" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ prefillToday: true }));
  });
});
