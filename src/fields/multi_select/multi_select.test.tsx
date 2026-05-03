import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { multiSelectFieldModule } from './index';
import type { MultiSelectField } from '@/types/field';

const OPTIONS = [
  { id: 'opt1', label: 'Red' },
  { id: 'opt2', label: 'Blue' },
  { id: 'opt3', label: 'Green' },
];

const baseField: MultiSelectField = {
  id: 'f1',
  type: 'multi_select',
  label: 'Colors',
  conditions: [],
  conditionLogic: 'OR',
  defaultVisible: true,
  defaultRequired: false,
  config: { options: OPTIONS },
};

const { validator, renderer: Renderer, configEditor: ConfigEditor } = multiSelectFieldModule;

// ── G2: Validator ──────────────────────────────────────────────────────────

describe('multi_select validator', () => {
  it('required + empty array → required error', () => {
    const errors = validator([], { options: OPTIONS }, { isRequired: true });
    expect(errors.some((e) => e.rule === 'required')).toBe(true);
  });

  it('optional + empty → no error', () => {
    expect(validator([], { options: OPTIONS }, { isRequired: false })).toHaveLength(0);
  });

  it.each([
    [['opt1'], 2, true],          // 1 selected, min=2 → error
    [['opt1', 'opt2'], 2, false], // exactly 2 → OK
    [['opt1', 'opt2', 'opt3'], 2, false], // 3 → OK
  ])('minSelections: selected=%j min=%d → error=%s', (val, min, shouldError) => {
    const errors = validator(val, { options: OPTIONS, minSelections: min }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'min_selections')).toBe(shouldError);
  });

  it.each([
    [['opt1', 'opt2', 'opt3'], 2, true],  // 3 > max=2 → error
    [['opt1', 'opt2'], 2, false],          // exactly 2 → OK
    [['opt1'], 2, false],                  // 1 < 2 → OK
  ])('maxSelections: selected=%j max=%d → error=%s', (val, max, shouldError) => {
    const errors = validator(val, { options: OPTIONS, maxSelections: max }, { isRequired: false });
    expect(errors.some((e) => e.rule === 'max_selections')).toBe(shouldError);
  });
});

// ── G3: Renderer ───────────────────────────────────────────────────────────

describe('multi_select renderer', () => {
  it('renders all options as checkboxes', () => {
    render(<Renderer field={baseField} value={[]} onChange={vi.fn()} isRequired={false} errors={[]} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('shows required asterisk', () => {
    render(<Renderer field={baseField} value={[]} onChange={vi.fn()} isRequired={true} errors={[]} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('fires onChange with array including selected item', () => {
    const onChange = vi.fn();
    render(<Renderer field={baseField} value={[]} onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith(['opt1']);
  });

  it('deselecting removes item from array', () => {
    const onChange = vi.fn();
    render(<Renderer field={baseField} value={['opt1']} onChange={onChange} isRequired={false} errors={[]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith(undefined); // empty → undefined
  });
});

// ── G3: ConfigEditor ───────────────────────────────────────────────────────

describe('multi_select configEditor', () => {
  it('renders without error', () => {
    const { container } = render(<ConfigEditor config={{ options: [] }} onChange={vi.fn()} allFields={[]} ownerFieldId="f1" />);
    expect(screen.getByText('Min selections')).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="number"]').length).toBeGreaterThan(0);
  });

  it('fires onChange when min selections updated', () => {
    const onChange = vi.fn();
    render(<ConfigEditor config={{ options: [] }} onChange={onChange} allFields={[]} ownerFieldId="f1" />);
    // First spinbutton is min selections
    fireEvent.change(screen.getAllByRole('spinbutton')[0]!, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minSelections: 2 }));
  });
});
